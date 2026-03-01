export type JobType =
  | 'ocr'
  | 'edital_extraction'
  | 'cat_extraction'
  | 'crossing'
  | 'embedding_gen'

export type JobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retrying'

export type JobEntityType = 'edital' | 'cat' | 'crossing'

export interface ProcessingJob {
  id: string
  tenantId: string
  jobType: JobType
  entityType: JobEntityType
  entityId: string
  status: JobStatus
  attemptCount: number
  errorMessage: string | null
  startedAt: Date | null
  completedAt: Date | null
  costUsd: number | null
  createdAt: Date
  updatedAt: Date
}
