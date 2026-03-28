import { z } from 'zod'
import { UpdateEditalSchema } from '@licitacat/shared/schemas'

export const PncpBuscarQuerySchema = z.object({
  tipo: z.enum(['publicacao', 'proposta']).default('publicacao'),
  dataInicial: z.string().regex(/^\d{8}$/, 'Use formato YYYYMMDD').optional(),
  dataFinal: z.string().regex(/^\d{8}$/, 'Use formato YYYYMMDD'),
  ufs: z.string().optional(), // CSV, ex: "SP,RJ,MG"
  codigoModalidadeContratacao: z.coerce.number().int().optional(),
  codigoModoDisputa: z.coerce.number().int().optional(),
  cnpj: z.string().optional(),
  codigoUnidadeAdministrativa: z.string().optional(),
  codigoMunicipioIbge: z.string().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamanhoPagina: z.coerce.number().int().min(10).max(50).default(20),
})

export const PncpDetalheQuerySchema = z.object({
  cnpj: z.string().min(14).max(18),
  ano: z.coerce.number().int().min(2000),
  sequencial: z.string().min(1),
})

export const PncpImportarBodySchema = z.object({
  sequencialCompra: z.coerce.string(),           // PNCP retorna como number
  numeroCompra: z.string().optional(),
  anoCompra: z.number(),
  objetoCompra: z.string(),
  valorTotalEstimado: z.number().nullable().optional(),
  dataPublicacaoPncp: z.string(),
  modalidadeId: z.number().optional(),
  modalidadeNome: z.string(),
  situacaoCompraNome: z.string().optional(),
  tipoInstrumentoConvocatorioNome: z.string().optional(),
  orgaoEntidade: z.object({
    cnpj: z.string(),
    nome: z.string().optional(),               // usado em alguns endpoints
    razaoSocial: z.string().optional(),        // usado na consulta /contratacoes
  }).optional(),
  unidadeOrgao: z.object({
    nomeUnidade: z.string().optional(),
    ufSigla: z.string().optional(),
    municipioNome: z.string().optional(),
  }).optional(),
  linkSistemaOrigem: z.string().nullable().optional(),
})

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

export { UpdateEditalSchema }
