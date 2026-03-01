import { z } from 'zod'

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

export const ALLOWED_EXTENSIONS = ['.pdf', '.xls', '.xlsx'] as const

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50MB

export const UploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  fileSize: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
  entityType: z.enum(['edital', 'cat']),
})

export type UploadRequestInput = z.infer<typeof UploadRequestSchema>
