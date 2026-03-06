import { Worker, type Job } from 'bullmq'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { db } from '@licitacat/db'
import { cats, catItens, processingJobs } from '@licitacat/db/schema'
import {
    callLlm,
    DEFAULT_MODEL,
    calculateCostUsd,
} from '@licitacat/ai/llm'
import { parseCatExtractionXml } from '@licitacat/ai/llm'
import {
    CAT_EXTRACTION_SYSTEM_PROMPT,
    buildCatExtractionUserPrompt,
} from '@licitacat/ai/prompts'
import { eq } from 'drizzle-orm'
import type { CatExtractionJobData } from '../queues/index.js'
import { embeddingGenQueue } from '../queues/index.js'

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

    const chunks: Uint8Array[] = []
    const stream = response.Body as AsyncIterable<Uint8Array>
    for await (const chunk of stream) {
        chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}

async function processCatExtraction(
    job: Job<CatExtractionJobData>,
): Promise<void> {
    const { tenantId, catId, jobId, fileUrl, fileType } = job.data

    await db
        .update(processingJobs)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(processingJobs.id, jobId))

    await db
        .update(cats)
        .set({ statusExtracao: 'processing' })
        .where(eq(cats.id, catId))

    try {
        if (fileType !== 'pdf_scanned' && fileType !== 'pdf_copyable') {
            throw new Error(`File type ${fileType} extraction not yet implemented`)
        }

        const pdfBuffer = await downloadFromS3(fileUrl)
        const userPrompt = buildCatExtractionUserPrompt('[O documento PDF está anexado acima. Extraia as informações diretamente do PDF.]')
        const response = await callLlm({
            max_tokens: 4096,
            system: CAT_EXTRACTION_SYSTEM_PROMPT,
            messages: [{
                role: 'user',
                content: userPrompt,
                inlineFiles: [{ data: pdfBuffer, mimeType: 'application/pdf' }],
            }],
        })

        const parsed = parseCatExtractionXml(response.text)

        await db
            .update(cats)
            .set({
                numeroCat: parsed.numeroCat,
                empresaContratante: parsed.empresaContratante,
                tipoObraServico: parsed.tipoObraServico,
                descricaoTecnica: parsed.descricaoTecnica,
                quantitativoValor: parsed.quantitativoValor?.toFixed(4) ?? null,
                quantitativoUnidade: parsed.quantitativoUnidade,
                dataInicio: parsed.dataInicio ? new Date(parsed.dataInicio) : null,
                dataConclusao: parsed.dataConclusao ? new Date(parsed.dataConclusao) : null,
                aiConfidenceScore: parsed.aiConfidenceScore,
                statusExtracao: 'review_pending',
            })
            .where(eq(cats.id, catId))

        if (parsed.itens.length > 0) {
            const insertedItens = await db
                .insert(catItens)
                .values(
                    parsed.itens.map((item, idx) => ({
                        tenantId,
                        catId,
                        numeroItem: item.numeroItem,
                        descricao: item.descricao,
                        unidade: item.unidade,
                        quantidade: item.quantidade?.toFixed(4) ?? null,
                        origem: 'ai_extracted' as const,
                        aiConfidenceScore: parsed.aiConfidenceScore,
                        ordem: idx,
                    })),
                )
                .returning()

            for (const item of insertedItens) {
                const [embJob] = await db
                    .insert(processingJobs)
                    .values({
                        tenantId,
                        jobType: 'embedding_gen',
                        entityType: 'cat',
                        entityId: item.id,
                        status: 'queued',
                    })
                    .returning()

                if (embJob) {
                    await embeddingGenQueue.add('embedding_gen', {
                        tenantId,
                        entityType: 'cat_item',
                        entityId: item.id,
                        text: item.descricao,
                        jobId: embJob.id,
                    })
                }
            }
        }

        if (parsed.descricaoTecnica) {
            const [catEmbJob] = await db
                .insert(processingJobs)
                .values({
                    tenantId,
                    jobType: 'embedding_gen',
                    entityType: 'cat',
                    entityId: catId,
                    status: 'queued',
                })
                .returning()

            if (catEmbJob) {
                await embeddingGenQueue.add('embedding_gen', {
                    tenantId,
                    entityType: 'cat',
                    entityId: catId,
                    text: parsed.descricaoTecnica,
                    jobId: catEmbJob.id,
                })
            }
        }

        const totalCost = calculateCostUsd(
            DEFAULT_MODEL,
            response.usage.input_tokens,
            response.usage.output_tokens,
        )

        await db
            .update(processingJobs)
            .set({
                status: 'completed',
                completedAt: new Date(),
                costUsd: totalCost.toFixed(6),
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

        if (status === 'failed') {
            await db
                .update(cats)
                .set({ statusExtracao: 'error' })
                .where(eq(cats.id, catId))
        }

        throw error
    }
}

export function createCatExtractionWorker(): Worker<CatExtractionJobData> {
    return new Worker<CatExtractionJobData>(
        'cat_extraction',
        processCatExtraction,
        {
            connection,
            concurrency: 2,
        },
    )
}
