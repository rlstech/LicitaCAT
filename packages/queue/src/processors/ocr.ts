import { Worker, type Job } from 'bullmq'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { db } from '@licitacat/db'
import { editais, processingJobs } from '@licitacat/db/schema'
import { processDocumentOcr } from '@licitacat/ai/ocr'
import { eq } from 'drizzle-orm'
import type { OcrJobData } from '../queues/index.js'
import { editalExtractionQueue } from '../queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const S3_BUCKET = process.env['S3_BUCKET'] ?? ''
const S3_REGION = process.env['S3_REGION'] ?? 'us-east-1'
const S3_ENDPOINT = process.env['S3_ENDPOINT']

const connection = {
    host: new URL(REDIS_URL).hostname,
    port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

function getS3Client(): S3Client {
    return new S3Client({
        region: S3_REGION,
        ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}),
    })
}

async function downloadFromS3(fileUrl: string): Promise<Buffer> {
    // fileUrl format: s3://bucket/key
    const s3Uri = fileUrl.replace('s3://', '')
    const slashIdx = s3Uri.indexOf('/')
    const bucket = s3Uri.substring(0, slashIdx)
    const key = s3Uri.substring(slashIdx + 1)

    const s3 = getS3Client()
    const response = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
    )

    if (!response.Body) {
        throw new Error(`Empty response from S3 for key: ${key}`)
    }

    // Convert stream to Buffer
    const chunks: Uint8Array[] = []
    const stream = response.Body as AsyncIterable<Uint8Array>
    for await (const chunk of stream) {
        chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}

async function processOcr(job: Job<OcrJobData>): Promise<void> {
    const { tenantId, editalId, jobId, fileUrl } = job.data

    // Mark job as running
    await db
        .update(processingJobs)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(processingJobs.id, jobId))

    // Update edital status
    await db
        .update(editais)
        .set({ status: 'ocr_processing' })
        .where(eq(editais.id, editalId))

    try {
        // Download PDF from S3
        const pdfBuffer = await downloadFromS3(fileUrl)

        // Run OCR via Google Document AI
        const ocrResult = await processDocumentOcr(pdfBuffer, 'application/pdf')

        // Update edital with OCR results
        await db
            .update(editais)
            .set({
                pageCount: ocrResult.pageCount,
                pdfType: ocrResult.pdfType,
                ocrCostUsd: ocrResult.costUsd.toFixed(6),
                status: 'extracting',
            })
            .where(eq(editais.id, editalId))

        // Create extraction job in processing_jobs
        const [extractionJob] = await db
            .insert(processingJobs)
            .values({
                tenantId,
                jobType: 'edital_extraction',
                entityType: 'edital',
                entityId: editalId,
                status: 'queued',
            })
            .returning()

        if (!extractionJob) throw new Error('Failed to create extraction job')

        // Enqueue edital extraction
        await editalExtractionQueue.add('edital_extraction', {
            tenantId,
            editalId,
            jobId: extractionJob.id,
            ocrText: ocrResult.text,
            pageCount: ocrResult.pageCount,
        })

        // Mark OCR job as completed
        await db
            .update(processingJobs)
            .set({
                status: 'completed',
                completedAt: new Date(),
                costUsd: ocrResult.costUsd.toFixed(6),
            })
            .where(eq(processingJobs.id, jobId))
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'

        const currentJob = await db.query.processingJobs.findFirst({
            where: eq(processingJobs.id, jobId),
        })

        const attemptCount = (currentJob?.attemptCount ?? 0) + 1
        const status = attemptCount >= 3 ? 'failed' : 'retrying'

        await db
            .update(processingJobs)
            .set({ status, errorMessage, attemptCount })
            .where(eq(processingJobs.id, jobId))

        // If failed permanently, update edital status
        if (status === 'failed') {
            await db
                .update(editais)
                .set({ status: 'error' })
                .where(eq(editais.id, editalId))
        }

        throw error
    }
}

export function createOcrWorker(): Worker<OcrJobData> {
    return new Worker<OcrJobData>('ocr', processOcr, {
        connection,
        concurrency: 2,
    })
}
