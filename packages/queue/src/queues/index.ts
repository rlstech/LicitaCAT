import { Queue } from 'bullmq'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

// Job data types
export interface EditalExtractionJobData {
  tenantId: string
  editalId: string
  jobId: string
  fileUrl: string
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
  entityType: 'edital_requisito' | 'cat' | 'cat_item' | 'parcela_relevancia'
  entityId: string
  text: string
  jobId: string
}

const retryJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 10000 },
}

// Queue definitions
export const editalExtractionQueue = new Queue<EditalExtractionJobData>(
  'edital_extraction',
  { connection, defaultJobOptions: retryJobOptions },
)

export const catExtractionQueue = new Queue<CatExtractionJobData>(
  'cat_extraction',
  { connection, defaultJobOptions: retryJobOptions },
)

export const crossingQueue = new Queue<CrossingJobData>('crossing', {
  connection,
  defaultJobOptions: retryJobOptions,
})

export const embeddingGenQueue = new Queue<EmbeddingGenJobData>(
  'embedding_gen',
  { connection, defaultJobOptions: retryJobOptions },
)

export interface PncpSyncJobData {
  tenantId: string
  configId: string
  triggeredBy: 'schedule' | 'manual'
}

export const pncpSyncQueue = new Queue<PncpSyncJobData>('pncp_sync', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential' as const, delay: 30000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
})

export const allQueues = [
  editalExtractionQueue,
  catExtractionQueue,
  crossingQueue,
  embeddingGenQueue,
  pncpSyncQueue,
] as const
