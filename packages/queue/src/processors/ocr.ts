import { Worker, type Job } from 'bullmq'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { PDFDocument } from 'pdf-lib'
import { db } from '@licitacat/db'
import { editais, processingJobs } from '@licitacat/db/schema'
import { processDocumentOcr } from '@licitacat/ai/ocr'
import { eq } from 'drizzle-orm'
import { createRequire } from 'module'
import { editalExtractionQueue } from '../queues/index.js'

// OcrJobData kept here as this processor is retained for historical reference
interface OcrJobData {
  tenantId: string
  editalId: string
  jobId: string
  fileUrl: string
}

// Document AI limit: 15 pages in non-imageless mode, but scanned PDFs can exceed 20MB payload.
// Using 6 pages per chunk to stay safely under the payload limit for high-res scanned PDFs.
const OCR_CHUNK_SIZE = 6

// Minimum average characters per page to consider a PDF as copyable (has native text).
const MIN_CHARS_PER_PAGE_COPYABLE = 100

// Try to extract text directly from a copyable PDF without using Document AI.
// Returns null if the PDF doesn't have enough native text (scanned).
async function tryDirectTextExtraction(
    pdfBuffer: Buffer,
    totalPages: number,
): Promise<{ text: string; pdfType: 'copyable' } | null> {
    try {
        // pdf-parse is a CJS module — use createRequire for ESM compatibility
        const require = createRequire(import.meta.url)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>
        const result = await pdfParse(pdfBuffer)
        const avgCharsPerPage = totalPages > 0 ? result.text.length / totalPages : 0
        if (avgCharsPerPage >= MIN_CHARS_PER_PAGE_COPYABLE) {
            return { text: result.text, pdfType: 'copyable' }
        }
    } catch {
        // pdf-parse failed — fall through to Document AI
    }
    return null
}

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

        // Determine total pages for chunking
        const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
        const totalPages = srcDoc.getPageCount()

        let fullText = ''
        let totalCostUsd = 0
        let finalPdfType: 'copyable' | 'scanned' | 'mixed' = 'copyable'

        // Try direct text extraction first (fast, free, no Document AI needed)
        const directResult = await tryDirectTextExtraction(pdfBuffer, totalPages)
        if (directResult) {
            fullText = directResult.text
            finalPdfType = directResult.pdfType
        } else {
            // PDF is scanned — use Document AI OCR in chunks
            let hasScanned = false
            let hasCopyable = false
            const numChunks = Math.ceil(totalPages / OCR_CHUNK_SIZE)

            for (let i = 0; i < numChunks; i++) {
                const startPage = i * OCR_CHUNK_SIZE
                const endPage = Math.min(startPage + OCR_CHUNK_SIZE - 1, totalPages - 1)

                const chunkDoc = await PDFDocument.create()
                const indices = Array.from({ length: endPage - startPage + 1 }, (_, k) => startPage + k)
                const copiedPages = await chunkDoc.copyPages(srcDoc, indices)
                for (const page of copiedPages) chunkDoc.addPage(page)
                const chunkBytes = await chunkDoc.save()
                const chunkBuffer = Buffer.from(chunkBytes)

                const chunkResult = await processDocumentOcr(chunkBuffer, 'application/pdf')
                fullText += (fullText ? '\n' : '') + chunkResult.text
                totalCostUsd += chunkResult.costUsd

                if (chunkResult.pdfType === 'scanned') hasScanned = true
                else if (chunkResult.pdfType === 'copyable') hasCopyable = true
                else { hasScanned = true; hasCopyable = true }
            }

            if (hasScanned && hasCopyable) finalPdfType = 'mixed'
            else if (hasScanned) finalPdfType = 'scanned'
            else finalPdfType = 'copyable'
        }

        // Update edital with OCR results
        await db
            .update(editais)
            .set({
                pageCount: totalPages,
                pdfType: finalPdfType,
                ocrCostUsd: totalCostUsd.toFixed(6),
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
            fileUrl,
        })

        // Mark OCR job as completed
        await db
            .update(processingJobs)
            .set({
                status: 'completed',
                completedAt: new Date(),
                costUsd: totalCostUsd.toFixed(6),
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
