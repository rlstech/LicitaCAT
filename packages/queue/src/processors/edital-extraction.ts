import { Worker, type Job } from 'bullmq'
import { db } from '@licitacat/db'
import { editais, editalRequisitos, processingJobs } from '@licitacat/db/schema'
import {
    callLlm,
    DEFAULT_MODEL,
    calculateCostUsd,
} from '@licitacat/ai/llm'
import {
    parseEditalRequisitosXml,
    parseEditalMetadataXml,
} from '@licitacat/ai/llm'
import {
    EDITAL_EXTRACTION_SYSTEM_PROMPT,
    buildEditalExtractionUserPrompt,
    buildEditalMetadataPrompt,
} from '@licitacat/ai/prompts'
import { eq } from 'drizzle-orm'
import type { EditalExtractionJobData } from '../queues/index.js'
import { embeddingGenQueue } from '../queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

const connection = {
    host: new URL(REDIS_URL).hostname,
    port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

const CHARS_PER_PAGE = 3000
const PAGES_PER_CHUNK = 15

function splitTextIntoChunks(
    text: string,
    pageCount: number,
): Array<{ text: string; pageRange: string }> {
    const charsPerChunk = PAGES_PER_CHUNK * CHARS_PER_PAGE
    const chunks: Array<{ text: string; pageRange: string }> = []
    let charIndex = 0
    let currentPage = 1

    while (charIndex < text.length) {
        const chunkText = text.slice(charIndex, charIndex + charsPerChunk)
        const endPage = Math.min(
            currentPage + PAGES_PER_CHUNK - 1,
            pageCount || currentPage + PAGES_PER_CHUNK - 1,
        )
        const pageRange = `páginas ${currentPage} a ${endPage}`

        chunks.push({ text: chunkText, pageRange })

        charIndex += charsPerChunk
        currentPage = endPage + 1
    }

    return chunks
}

async function processEditalExtraction(
    job: Job<EditalExtractionJobData>,
): Promise<void> {
    const { tenantId, editalId, jobId, ocrText, pageCount } = job.data

    await db
        .update(processingJobs)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(processingJobs.id, jobId))

    try {
        let totalInputTokens = 0
        let totalOutputTokens = 0
        const allRequisitos: Array<{
            lote: string | null
            categoria: string
            descricao: string
            trechoOriginal: string | null
            paginaReferencia: number | null
            quantitativoExigido: number | null
            unidade: string | null
            aiConfidenceScore: number
        }> = []

        // 1. Extract metadata from first pages
        const metadataPrompt = buildEditalMetadataPrompt(ocrText)
        const metadataResponse = await callLlm({
            max_tokens: 1024,
            messages: [{ role: 'user', content: metadataPrompt }],
        })

        totalInputTokens += metadataResponse.usage.input_tokens
        totalOutputTokens += metadataResponse.usage.output_tokens

        const metadata = parseEditalMetadataXml(metadataResponse.text)

        await db
            .update(editais)
            .set({
                orgaoLicitante: metadata.orgaoLicitante,
                numeroEdital: metadata.numeroEdital,
                modalidade: metadata.modalidade as typeof editais._.columns.modalidade._.data | null,
                objeto: metadata.objeto,
                valorEstimado: metadata.valorEstimado?.toFixed(2) ?? null,
                dataAbertura: metadata.dataAbertura ? new Date(metadata.dataAbertura) : null,
            })
            .where(eq(editais.id, editalId))

        // 2. Extract requisitos from text chunks
        const chunks = splitTextIntoChunks(ocrText, pageCount)

        for (const chunk of chunks) {
            const userPrompt = buildEditalExtractionUserPrompt(
                chunk.text,
                chunk.pageRange,
            )

            const response = await callLlm({
                max_tokens: 4096,
                system: EDITAL_EXTRACTION_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userPrompt }],
            })

            totalInputTokens += response.usage.input_tokens
            totalOutputTokens += response.usage.output_tokens

            const chunkRequisitos = parseEditalRequisitosXml(response.text)
            allRequisitos.push(...chunkRequisitos)
        }

        // 3. Deduplicate requisitos
        const seen = new Set<string>()
        const uniqueRequisitos = allRequisitos.filter((r) => {
            const key = r.descricao.toLowerCase().trim()
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })

        // 4. Insert requisitos
        if (uniqueRequisitos.length > 0) {
            const insertedRequisitos = await db
                .insert(editalRequisitos)
                .values(
                    uniqueRequisitos.map((r) => ({
                        tenantId,
                        editalId,
                        lote: r.lote,
                        categoria: r.categoria as typeof editalRequisitos._.columns.categoria._.data,
                        descricao: r.descricao,
                        trechoOriginal: r.trechoOriginal,
                        paginaReferencia: r.paginaReferencia,
                        quantitativoExigido: r.quantitativoExigido?.toFixed(4) ?? null,
                        unidade: r.unidade,
                        aiConfidenceScore: r.aiConfidenceScore,
                        status: 'ai_extracted' as const,
                    })),
                )
                .returning()

            // 5. Enqueue embedding generation
            for (const requisito of insertedRequisitos) {
                const [embJob] = await db
                    .insert(processingJobs)
                    .values({
                        tenantId,
                        jobType: 'embedding_gen',
                        entityType: 'edital',
                        entityId: requisito.id,
                        status: 'queued',
                    })
                    .returning()

                if (embJob) {
                    await embeddingGenQueue.add('embedding_gen', {
                        tenantId,
                        entityType: 'edital_requisito',
                        entityId: requisito.id,
                        text: requisito.descricao,
                        jobId: embJob.id,
                    })
                }
            }
        }

        // 6. Calculate cost and update
        const totalCost = calculateCostUsd(
            DEFAULT_MODEL,
            totalInputTokens,
            totalOutputTokens,
        )

        await db
            .update(editais)
            .set({
                status: 'review_pending',
                aiExtractionCostUsd: totalCost.toFixed(6),
            })
            .where(eq(editais.id, editalId))

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
                .update(editais)
                .set({ status: 'error' })
                .where(eq(editais.id, editalId))
        }

        throw error
    }
}

export function createEditalExtractionWorker(): Worker<EditalExtractionJobData> {
    return new Worker<EditalExtractionJobData>(
        'edital_extraction',
        processEditalExtraction,
        {
            connection,
            concurrency: 2,
        },
    )
}
