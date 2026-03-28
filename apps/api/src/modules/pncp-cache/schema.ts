import { z } from 'zod'

export const PncpCacheBuscarQuerySchema = z.object({
  objeto:              z.string().max(500).optional(),
  ufs:                 z.string().optional(),              // CSV: "SP,RJ"
  modalidade:          z.coerce.number().int().optional(),
  codigoMunicipioIbge: z.string().optional(),
  nomeMunicipio:       z.string().max(200).optional(),
  situacaoCompraId:    z.coerce.number().int().optional(),
  valorMin:            z.coerce.number().min(0).optional(),
  valorMax:            z.coerce.number().min(0).optional(),
  dataInicial:         z.string().regex(/^\d{8}$/).optional(),  // YYYYMMDD
  dataFinal:           z.string().regex(/^\d{8}$/).optional(),
  page:                z.coerce.number().int().min(1).default(1),
  limit:               z.coerce.number().int().min(10).max(100).default(20),
  sortBy:              z.enum(['dataPublicacaoPncp', 'valorTotalEstimado', 'dataAberturaProposta']).default('dataPublicacaoPncp'),
  sortOrder:           z.enum(['asc', 'desc']).default('desc'),
})

export type PncpCacheBuscarQuery = z.infer<typeof PncpCacheBuscarQuerySchema>

export const PncpSyncConfigBodySchema = z.object({
  ufs:           z.array(z.string().length(2).toUpperCase()).min(1).max(27),
  modalidades:   z.array(z.number().int()).default([]),
  retentionDays: z.number().int().min(7).max(365).default(90),
  isActive:      z.boolean().default(true),
})

export type PncpSyncConfigBody = z.infer<typeof PncpSyncConfigBodySchema>
