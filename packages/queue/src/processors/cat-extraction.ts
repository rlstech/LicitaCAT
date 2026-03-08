import { Worker, type Job } from 'bullmq'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { PDFDocument } from 'pdf-lib'
import { db } from '@licitacat/db'
import { cats, catItens, processingJobs } from '@licitacat/db/schema'
import {
    callLlm,
    DEFAULT_MODEL,
    calculateCostUsd,
    parseCatExtractionXml,
    parseCatItemsOnlyXml,
} from '@licitacat/ai/llm'
import { processDocumentFormParser } from '@licitacat/ai/ocr'
import {
    CAT_EXTRACTION_SYSTEM_PROMPT,
    buildCatExtractionUserPrompt,
    buildCatItemsOnlyUserPrompt,
} from '@licitacat/ai/prompts'
import { eq } from 'drizzle-orm'
import type { CatExtractionJobData } from '../queues/index.js'
import { embeddingGenQueue } from '../queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const S3_BUCKET = process.env['S3_BUCKET'] ?? ''
const S3_REGION = process.env['S3_REGION'] ?? 'us-east-1'
const S3_ENDPOINT = process.env['S3_ENDPOINT']

// Form Parser online limit is 15 pages
const CHUNK_SIZE = 15

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

async function getPdfPageCount(buffer: Buffer): Promise<number> {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    return pdfDoc.getPageCount()
}

async function extractPdfPageRange(
    buffer: Buffer,
    startPage: number,
    endPage: number,
): Promise<Buffer> {
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const newDoc = await PDFDocument.create()

    const pageIndices: number[] = []
    for (let i = startPage; i <= endPage; i++) {
        pageIndices.push(i)
    }

    const copiedPages = await newDoc.copyPagesFrom(srcDoc, pageIndices)
    for (const page of copiedPages) {
        newDoc.addPage(page)
    }

    const bytes = await newDoc.save()
    return Buffer.from(bytes)
}

const FORM_PARSER_CONFIGURED =
    !!process.env['GOOGLE_DOCUMENT_AI_PROJECT_ID'] &&
    !!process.env['GOOGLE_DOCUMENT_AI_PROCESSOR_ID']

/**
 * Extracts text from a PDF chunk.
 * Uses Form Parser (Document AI) when configured — preserves tables and form fields.
 * Falls back to sending the raw PDF inline to the LLM when not configured.
 */
async function extractChunkText(
    chunkBuffer: Buffer,
    pageRange: string,
    totalPages: number,
): Promise<{ text: string; docAiCostUsd: number }> {
    if (FORM_PARSER_CONFIGURED) {
        const result = await processDocumentFormParser(chunkBuffer, 'application/pdf')
        return { text: result.formattedText, docAiCostUsd: result.costUsd }
    }
    // Fallback: return a placeholder so the LLM receives the PDF inline
    return {
        text: `[PDF anexado — páginas ${pageRange} de ${totalPages}]`,
        docAiCostUsd: 0,
    }
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
        const totalPages = await getPdfPageCount(pdfBuffer)
        const numChunks = Math.ceil(totalPages / CHUNK_SIZE)

        let parsedMeta: ReturnType<typeof parseCatExtractionXml> | null = null
        const allItems: ReturnType<typeof parseCatItemsOnlyXml> = []
        let totalInputTokens = 0
        let totalOutputTokens = 0
        let totalDocAiCostUsd = 0

        for (let i = 0; i < numChunks; i++) {
            const startPage = i * CHUNK_SIZE
            const endPage = Math.min(startPage + CHUNK_SIZE - 1, totalPages - 1)
            const chunkBuffer = await extractPdfPageRange(pdfBuffer, startPage, endPage)
            const pageRange = `${startPage + 1}-${endPage + 1}`

            const { text: chunkText, docAiCostUsd } = await extractChunkText(
                chunkBuffer,
                pageRange,
                totalPages,
            )
            totalDocAiCostUsd += docAiCostUsd

            if (i === 0) {
                const userPrompt = buildCatExtractionUserPrompt(chunkText)

                const llmPayload = FORM_PARSER_CONFIGURED
                    ? {
                          max_tokens: 8192,
                          system: CAT_EXTRACTION_SYSTEM_PROMPT,
                          messages: [{ role: 'user' as const, content: userPrompt }],
                      }
                    : {
                          max_tokens: 8192,
                          system: CAT_EXTRACTION_SYSTEM_PROMPT,
                          messages: [{
                              role: 'user' as const,
                              content: userPrompt,
                              inlineFiles: [{ data: chunkBuffer, mimeType: 'application/pdf' as const }],
                          }],
                      }

                const response = await callLlm(llmPayload)
                parsedMeta = parseCatExtractionXml(response.text)
                allItems.push(...parsedMeta.itens)
                totalInputTokens += response.usage.input_tokens
                totalOutputTokens += response.usage.output_tokens
            } else {
                const userPrompt = buildCatItemsOnlyUserPrompt(pageRange)
                const fullPrompt = FORM_PARSER_CONFIGURED
                    ? `${userPrompt}\n\nTexto extraído:\n${chunkText}`
                    : userPrompt

                const llmPayload = FORM_PARSER_CONFIGURED
                    ? {
                          max_tokens: 8192,
                          system: CAT_EXTRACTION_SYSTEM_PROMPT,
                          messages: [{ role: 'user' as const, content: fullPrompt }],
                      }
                    : {
                          max_tokens: 8192,
                          system: CAT_EXTRACTION_SYSTEM_PROMPT,
                          messages: [{
                              role: 'user' as const,
                              content: userPrompt,
                              inlineFiles: [{ data: chunkBuffer, mimeType: 'application/pdf' as const }],
                          }],
                      }

                const response = await callLlm(llmPayload)
                const chunkItems = parseCatItemsOnlyXml(response.text)
                allItems.push(...chunkItems)
                totalInputTokens += response.usage.input_tokens
                totalOutputTokens += response.usage.output_tokens
            }
        }

        if (!parsedMeta) {
            throw new Error('Failed to extract CAT metadata from first chunk')
        }

        const filteredItems = allItems.filter(
            item => item.quantidade !== null && !isNaN(item.quantidade) && item.quantidade > 0,
        )

        await db
            .update(cats)
            .set({
                numeroCat: parsedMeta.numeroCat,
                empresaContratante: parsedMeta.empresaContratante,
                tipoObraServico: parsedMeta.tipoObraServico,
                descricaoTecnica: parsedMeta.descricaoTecnica,
                quantitativoValor: parsedMeta.quantitativoValor?.toFixed(4) ?? null,
                quantitativoUnidade: parsedMeta.quantitativoUnidade,
                dataInicio: parsedMeta.dataInicio ? new Date(parsedMeta.dataInicio) : null,
                dataConclusao: parsedMeta.dataConclusao ? new Date(parsedMeta.dataConclusao) : null,
                aiConfidenceScore: parsedMeta.aiConfidenceScore,
                statusExtracao: 'review_pending',
            })
            .where(eq(cats.id, catId))

        if (filteredItems.length > 0) {
            const insertedItens = await db
                .insert(catItens)
                .values(
                    filteredItems.map((item, idx) => ({
                        tenantId,
                        catId,
                        numeroItem: item.numeroItem,
                        descricao: item.descricao,
                        unidade: item.unidade,
                        quantidade: item.quantidade!.toFixed(4),
                        origem: 'ai_extracted' as const,
                        aiConfidenceScore: parsedMeta!.aiConfidenceScore,
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

        if (parsedMeta.descricaoTecnica) {
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
                    text: parsedMeta.descricaoTecnica,
                    jobId: catEmbJob.id,
                })
            }
        }

        const llmCostUsd = calculateCostUsd(DEFAULT_MODEL, totalInputTokens, totalOutputTokens)
        const totalCost = llmCostUsd + totalDocAiCostUsd

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
