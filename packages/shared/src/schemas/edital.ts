import { z } from 'zod'

export const CreateEditalSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url(),
})

export const UpdateEditalSchema = z.object({
  orgaoLicitante: z.string().min(1).max(500).optional(),
  numeroEdital: z.string().min(1).max(100).optional(),
  modalidade: z
    .enum([
      'pregao_eletronico',
      'pregao_presencial',
      'concorrencia',
      'tomada_de_precos',
      'convite',
      'leilao',
      'concurso',
      'rdc',
      'credenciamento',
      'outro',
    ])
    .optional(),
  objeto: z.string().min(1).max(2000).optional(),
  valorEstimado: z.number().positive().optional(),
  dataAbertura: z.coerce.date().optional(),
})

export const UpdateRequisitoSchema = z.object({
  descricao: z.string().min(1).max(2000).optional(),
  quantitativoExigido: z.number().positive().optional(),
  unidade: z.string().min(1).max(50).optional(),
  status: z
    .enum(['human_approved', 'human_edited', 'human_rejected'])
    .optional(),
  lote: z.string().max(100).optional(),
})

export type CreateEditalInput = z.infer<typeof CreateEditalSchema>
export type UpdateEditalInput = z.infer<typeof UpdateEditalSchema>
export type UpdateRequisitoInput = z.infer<typeof UpdateRequisitoSchema>
