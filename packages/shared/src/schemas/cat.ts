import { z } from 'zod'

export const CreateProfissionalSchema = z.object({
  nome: z.string().min(1).max(300),
  numeroCreaCau: z.string().min(1).max(50),
  conselho: z.enum(['CREA', 'CAU']),
  ufRegistro: z.string().length(2).toUpperCase(),
})

export const UpdateProfissionalSchema = CreateProfissionalSchema.partial()

export const CreateCatSchema = z.object({
  profissionalId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url(),
  fileType: z.enum(['pdf_scanned', 'pdf_copyable', 'excel', 'manual']),
})

export const UpdateCatSchema = z.object({
  numeroCat: z.string().min(1).max(100).optional(),
  empresaContratante: z.string().min(1).max(500).optional(),
  tipoObraServico: z.string().min(1).max(500).optional(),
  descricaoTecnica: z.string().min(1).max(5000).optional(),
  quantitativoValor: z.number().positive().optional(),
  quantitativoUnidade: z.string().min(1).max(50).optional(),
  dataInicio: z.coerce.date().optional(),
  dataConclusao: z.coerce.date().optional(),
  ativo: z.boolean().optional(),
})

export const CreateCatItemSchema = z.object({
  descricao: z.string().min(1).max(2000),
  unidade: z.string().min(1).max(50).optional(),
  quantidade: z.number().positive().optional(),
  numeroItem: z.number().int().positive().optional(),
  ordem: z.number().int().min(0).default(0),
})

export const UpdateCatItemSchema = CreateCatItemSchema.partial()

export type CreateProfissionalInput = z.infer<typeof CreateProfissionalSchema>
export type UpdateProfissionalInput = z.infer<typeof UpdateProfissionalSchema>
export type CreateCatInput = z.infer<typeof CreateCatSchema>
export type UpdateCatInput = z.infer<typeof UpdateCatSchema>
export type CreateCatItemInput = z.infer<typeof CreateCatItemSchema>
export type UpdateCatItemInput = z.infer<typeof UpdateCatItemSchema>
