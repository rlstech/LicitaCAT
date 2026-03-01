import { Queue } from 'bullmq'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

// Job data types
export interface OcrJobData {
  tenantId: string
  editalId: string
  jobId: string
  fileUrl: string
}

export interface EditalExtractionJobData {
  tenantId: string
  editalId: string
  jobId: string
  ocrText: string
  pageCount: number
}

export interface CatExtractionJobData {
  tenantId: string
  catId: string
  jobId: string
  fileUrl: string
  fileType: 'pdf_scanned' | 'pdf_copyable' | 'excel' | 'manual'
}

export interface CrossingJobData {
  tenantId: string
  crossingId: string
  editalId: string
  jobId: string
}

export interface EmbeddingGenJobData {
  tenantId: string
  entityType: 'edital_requisito' | 'cat' | 'cat_item'
  entityId: string
  text: string
  jobId: string
}

// Queue definitions
export const ocrQueue = new Queue<OcrJobData>('ocr', { connection })

export const editalExtractionQueue = new Queue<EditalExtractionJobData>(
  'edital_extraction',
  { connection },
)

export const catExtractionQueue = new Queue<CatExtractionJobData>(
  'cat_extraction',
  { connection },
)

export const crossingQueue = new Queue<CrossingJobData>('crossing', {
  connection,
})

export const embeddingGenQueue = new Queue<EmbeddingGenJobData>(
  'embedding_gen',
  { connection },
)

export const allQueues = [
  ocrQueue,
  editalExtractionQueue,
  catExtractionQueue,
  crossingQueue,
  embeddingGenQueue,
] as const
