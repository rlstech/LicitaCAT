import { Worker, type Job } from 'bullmq'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { PDFDocument } from 'pdf-lib'
import { createRequire } from 'module'
const _require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pdfParse = _require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>
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

// Pages per LLM call. Each chunk's output must fit in MAX_OUTPUT_TOKENS.
// If a chunk hits MAX_TOKENS the processor splits it in half and retries (down to 1 page).
const CHUNK_SIZE = 3
const MAX_OUTPUT_TOKENS = 8192

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

    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices)
    for (const page of copiedPages) {
        newDoc.addPage(page)
    }

    const bytes = await newDoc.save()
    return Buffer.from(bytes)
}

/**
 * Stamp/seal text patterns commonly found overlaid on CAT documents.
 * The CREA/CAU seal covers part of the table (usually the unit column) and
 * its text gets mixed into item descriptions during PDF text extraction.
 */
const STAMP_PATTERNS: RegExp[] = [
    /\s*Atestado\s+registrado\s+mediante\s+vincula[cç][aã]o\s+[aà]\s+respectiva\s+CAT\s*/gi,
    /\s*registrado\s+mediante\s+CAT\s*/gi,
    /\s*vincula[cç][aã]o\s+[aà]\s+respectiva\s*/gi,
    /\s*Atestado\s+registrado\s+mediante\s*/gi,
    /\s*CREA\s*[-–]\s*[A-Z]{2}\s*/g,
    /\s*CAU\s*[-–]\s*[A-Z]{2}\s*/g,
    // Registration codes like "A 0063.414" or "A0063414"
    /\s+A\s+\d{4}[.,]\d{3,4}\b/g,
    /\s+A\d{7,10}\b/g,
]

/**
 * Removes CREA/CAU stamp text that got mixed into an item description.
 * Returns the cleaned description and a flag indicating if stamp text was found
 * (used to infer a missing unit — the stamp likely covered the unit column).
 */
function cleanStampFromDescription(descricao: string): { descricao: string; hadStamp: boolean } {
    let cleaned = descricao
    let hadStamp = false
    for (const pattern of STAMP_PATTERNS) {
        const before = cleaned
        cleaned = cleaned.replace(pattern, ' ').trim()
        if (cleaned !== before) hadStamp = true
    }
    return { descricao: cleaned.replace(/\s{2,}/g, ' ').trim(), hadStamp }
}

/**
 * Cleans a unit string extracted by the LLM.
 * Only strips a leading number when followed by at least one space before the unit text.
 * e.g. "33 M2" → "M2", "100 UN" → "UN", "1.5 KG" → "KG"
 * Leaves "UN", "M2", "KG", "3/4" etc. unchanged.
 */
function cleanUnit(unit: string | null): string | null {
    if (!unit) return null
    const trimmed = unit.trim()
    if (!trimmed) return null
    // Strip leading number ONLY when there is explicit whitespace before the unit letters
    const cleaned = trimmed.replace(/^\d[\d.,]*\s+(?=[A-Za-z])/, '').trim()
    // If what remains is purely numeric, the whole value was a stray number → discard
    if (/^\d+([.,]\d+)?$/.test(cleaned)) return null
    return cleaned || null
}

const FORM_PARSER_CONFIGURED =
    !!process.env['GOOGLE_DOCUMENT_AI_PROJECT_ID'] &&
    !!process.env['GOOGLE_DOCUMENT_AI_PROCESSOR_ID']

/**
 * Extracts text from a PDF chunk.
 * Priority:
 *  1. Google Document AI Form Parser (best for scanned/complex tables)
 *  2. Native pdf-parse (for copyable PDFs — free, fast, no external API)
 *  3. Inline PDF to LLM (fallback for scanned PDFs without Document AI)
 */
async function extractChunkText(
    chunkBuffer: Buffer,
    pageRange: string,
    totalPages: number,
    fileType: string,
): Promise<{ text: string; docAiCostUsd: number; hasText: boolean }> {
    if (FORM_PARSER_CONFIGURED) {
        const result = await processDocumentFormParser(chunkBuffer, 'application/pdf')
        return { text: result.formattedText, docAiCostUsd: result.costUsd, hasText: true }
    }
    // Try native text extraction for any PDF — fast, free, no API needed
    // Falls back to inline PDF if the document is scanned (no embedded text)
    try {
        const parsed = await pdfParse(chunkBuffer)
        const text = parsed.text.trim()
        if (text.length > 100) {
            console.log(`[cat-extraction] pdf-parse extracted ${text.length} chars from pages ${pageRange} (type=${fileType})`)
            return { text, docAiCostUsd: 0, hasText: true }
        }
        console.log(`[cat-extraction] pdf-parse yielded ${text.length} chars (likely scanned) — using inline PDF for pages ${pageRange}`)
    } catch (e) {
        console.warn(`[cat-extraction] pdf-parse failed for pages ${pageRange}, falling back to inline PDF:`, e)
    }
    // Fallback: return a placeholder so the LLM receives the PDF inline
    return {
        text: `[PDF anexado — páginas ${pageRange} de ${totalPages}]`,
        docAiCostUsd: 0,
        hasText: false,
    }
}

interface ChunkResult {
    items: ReturnType<typeof parseCatItemsOnlyXml>
    meta?: ReturnType<typeof parseCatExtractionXml>
    inputTokens: number
    outputTokens: number
    docAiCostUsd: number
}

/**
 * Processes a PDF page range, extracting CAT items (and optionally header metadata).
 * If the LLM response hits MAX_TOKENS (truncated), the chunk is split in half and each
 * half is retried — recursively, down to a single page — so no content is lost.
 */
async function processChunkItems(
    pdfBuffer: Buffer,
    startPage: number,
    endPage: number,
    totalPages: number,
    fileType: string,
    isFirst: boolean,
): Promise<ChunkResult> {
    const chunkBuffer = await extractPdfPageRange(pdfBuffer, startPage, endPage)
    const pageRange = `${startPage + 1}-${endPage + 1}`

    const { text: chunkText, docAiCostUsd, hasText } = await extractChunkText(
        chunkBuffer, pageRange, totalPages, fileType,
    )

    let response: Awaited<ReturnType<typeof callLlm>>

    if (isFirst) {
        const userPrompt = buildCatExtractionUserPrompt(chunkText)
        const llmPayload = hasText
            ? { max_tokens: MAX_OUTPUT_TOKENS, system: CAT_EXTRACTION_SYSTEM_PROMPT, messages: [{ role: 'user' as const, content: userPrompt }] }
            : { max_tokens: MAX_OUTPUT_TOKENS, system: CAT_EXTRACTION_SYSTEM_PROMPT, messages: [{ role: 'user' as const, content: userPrompt, inlineFiles: [{ data: chunkBuffer, mimeType: 'application/pdf' as const }] }] }
        response = await callLlm(llmPayload)
    } else {
        const userPrompt = buildCatItemsOnlyUserPrompt(pageRange)
        const fullPrompt = hasText ? `${userPrompt}\n\nTexto extraído:\n${chunkText}` : userPrompt
        const llmPayload = hasText
            ? { max_tokens: MAX_OUTPUT_TOKENS, system: CAT_EXTRACTION_SYSTEM_PROMPT, messages: [{ role: 'user' as const, content: fullPrompt }] }
            : { max_tokens: MAX_OUTPUT_TOKENS, system: CAT_EXTRACTION_SYSTEM_PROMPT, messages: [{ role: 'user' as const, content: userPrompt, inlineFiles: [{ data: chunkBuffer, mimeType: 'application/pdf' as const }] }] }
        response = await callLlm(llmPayload)
    }

    // If output was truncated AND chunk has more than 1 page: split in half and retry each half
    if (response.finishReason === 'MAX_TOKENS' && endPage > startPage) {
        const mid = Math.floor((startPage + endPage) / 2)
        console.warn(`[cat-extraction] pages ${pageRange} hit MAX_TOKENS — splitting into ${startPage + 1}-${mid + 1} and ${mid + 2}-${endPage + 1}`)
        const r1 = await processChunkItems(pdfBuffer, startPage, mid, totalPages, fileType, isFirst)
        const r2 = await processChunkItems(pdfBuffer, mid + 1, endPage, totalPages, fileType, false)
        return {
            meta: r1.meta,
            items: [...r1.items, ...r2.items],
            inputTokens: r1.inputTokens + r2.inputTokens,
            outputTokens: r1.outputTokens + r2.outputTokens,
            docAiCostUsd: r1.docAiCostUsd + r2.docAiCostUsd,
        }
    }

    if (response.finishReason === 'MAX_TOKENS') {
        console.warn(`[cat-extraction] pages ${pageRange} hit MAX_TOKENS on a single page — items may be incomplete`)
    }

    if (isFirst) {
        const meta = parseCatExtractionXml(response.text)
        return { meta, items: meta.itens, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, docAiCostUsd }
    } else {
        const items = parseCatItemsOnlyXml(response.text)
        return { items, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, docAiCostUsd }
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
            const isFirst = i === 0

            console.log(`[cat-extraction] processing pages ${startPage + 1}-${endPage + 1} of ${totalPages}`)

            const result = await processChunkItems(pdfBuffer, startPage, endPage, totalPages, fileType, isFirst)

            if (isFirst && result.meta) parsedMeta = result.meta
            allItems.push(...result.items)
            totalInputTokens += result.inputTokens
            totalOutputTokens += result.outputTokens
            totalDocAiCostUsd += result.docAiCostUsd
        }

        if (!parsedMeta) {
            throw new Error('Failed to extract CAT metadata from first chunk')
        }

        // Clean stamp/seal text from descriptions, then keep only items with quantity > 0.
        const filteredItems = allItems
            .map(item => {
                const { descricao: cleanedDesc, hadStamp } = cleanStampFromDescription(item.descricao)
                return {
                    ...item,
                    descricao: cleanedDesc,
                    // If the stamp covered the unit column and LLM returned no unit, default to UN
                    unidade: item.unidade ? item.unidade : (hadStamp ? 'UN' : null),
                }
            })
            .filter(
                item =>
                    item.descricao.length > 0 &&
                    item.quantidade !== null &&
                    !isNaN(item.quantidade) &&
                    item.quantidade > 0,
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

        // Delete any previously inserted items (idempotent retry support)
        await db.delete(catItens).where(eq(catItens.catId, catId))

        if (filteredItems.length > 0) {
            const insertedItens = await db
                .insert(catItens)
                .values(
                    filteredItems.map((item, idx) => ({
                        tenantId,
                        catId,
                        numeroItem: idx + 1,           // always sequential, ignoring LLM-provided number
                        descricao: item.descricao,
                        unidade: cleanUnit(item.unidade),
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
                        entityType: 'cat_item',
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
