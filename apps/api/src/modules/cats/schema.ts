import { z } from 'zod'
import {
  CreateProfissionalSchema,
  UpdateProfissionalSchema,
  CreateCatSchema,
  UpdateCatSchema,
  CreateCatItemSchema,
  UpdateCatItemSchema,
} from '@licitacat/shared/schemas'

export const CatParamsSchema = z.object({
  catId: z.string().uuid(),
})

export const CatItemParamsSchema = z.object({
  catId: z.string().uuid(),
  itemId: z.string().uuid(),
})

export const ProfissionalParamsSchema = z.object({
  profissionalId: z.string().uuid(),
})

export const ListCatsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  profissionalId: z.string().uuid().optional(),
  ativo: z.coerce.boolean().optional(),
})

export {
  CreateProfissionalSchema,
  UpdateProfissionalSchema,
  CreateCatSchema,
  UpdateCatSchema,
  CreateCatItemSchema,
  UpdateCatItemSchema,
}
