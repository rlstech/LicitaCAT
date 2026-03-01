import { z } from 'zod'
import { UpdateEditalSchema, UpdateRequisitoSchema } from '@licitacat/shared/schemas'

export const ListEditaisQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['uploaded', 'ocr_processing', 'extracting', 'review_pending', 'ready', 'error'])
    .optional(),
})

export const EditalParamsSchema = z.object({
  editalId: z.string().uuid(),
})

export const RequisitoParamsSchema = z.object({
  editalId: z.string().uuid(),
  requisitoId: z.string().uuid(),
})

export { UpdateEditalSchema, UpdateRequisitoSchema }
