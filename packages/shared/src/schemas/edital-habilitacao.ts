import { z } from 'zod'

const HabilitacaoJuridicaItemSchema = z.object({
  documento: z.string(),
  aplicaA: z.string().nullable().optional(),
  observacao: z.string().nullable().optional(),
})

const RegularidadeFiscalItemSchema = z.object({
  documento: z.string(),
  sigla: z.string().nullable().optional(),
  validadeDias: z.coerce.number().int().nullable().optional(),
  observacao: z.string().nullable().optional(),
})

const QualificacaoTecnicaSchema = z.object({
  registroConselho: z.string().nullable().optional(),
  exigeVisitaTecnica: z.boolean().default(false),
  visitaTipo: z.string().nullable().optional(),
  exigeEscritorioLocal: z.boolean().default(false),
  escritorioDescricao: z.string().nullable().optional(),
})

const ProfissionalItemSchema = z.object({
  cargo: z.string(),
  conselho: z.string().nullable().optional(),
  quantidade: z.coerce.number().int().nullable().optional(),
  cbo: z.string().nullable().optional(),
  observacao: z.string().nullable().optional(),
})

const ParcelaRelevanciaItemSchema = z.object({
  servico: z.string(),
  unidade: z.string().nullable().optional(),
  quantidadeMinima: z.coerce.number().nullable().optional(),
  observacao: z.string().nullable().optional(),
})

const AtestadoProfissionalItemSchema = z.object({
  profissional: z.string(),
  caracteristicasExigidas: z.string().nullable().optional(),
  exigeCat: z.boolean().default(false),
  observacao: z.string().nullable().optional(),
})

const QualificacaoFinanceiraSchema = z.object({
  exigeBalanco: z.boolean().default(false),
  balancoExercicios: z.coerce.number().int().nullable().optional(),
  patrimonioLiquidoMinimo: z.coerce.number().nullable().optional(),
  patrimonioPercentualContrato: z.coerce.number().nullable().optional(),
  lcMinimo: z.coerce.number().nullable().optional(),
  lgMinimo: z.coerce.number().nullable().optional(),
  sgMinimo: z.coerce.number().nullable().optional(),
  exigeCertidaoFalencia: z.boolean().default(false),
  certidaoFalenciaPrazoDias: z.coerce.number().int().nullable().optional(),
  exigeCapitalSocialMinimo: z.boolean().default(false),
  capitalSocialMinimo: z.coerce.number().nullable().optional(),
  exigeGarantiaProposta: z.boolean().default(false),
  garantiaPropostaPercentual: z.coerce.number().nullable().optional(),
  observacao: z.string().nullable().optional(),
})

const DeclaracaoItemSchema = z.object({
  descricao: z.string(),
  baseLegal: z.string().nullable().optional(),
  leiEstadual: z.boolean().default(false),
  penalidadeOmissao: z.string().nullable().optional(),
})

const DeclaracaoEspecialItemSchema = z.object({
  descricao: z.string(),
  lei: z.string().nullable().optional(),
  uf: z.string().max(2).nullable().optional(),
})

const AlertaItemSchema = z.object({
  nivel: z.enum(['critico', 'atencao', 'informacao']),
  categoria: z.string().nullable().optional(),
  descricao: z.string(),
})

const AnexoReferenciadoItemSchema = z.object({
  identificacao: z.string(),
  descricao: z.string().nullable().optional(),
})

const MetadataSchema = z.object({
  orgaoLicitante: z.string().nullable().optional(),
  uasg: z.string().nullable().optional(),
  numeroEdital: z.string().nullable().optional(),
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
    .nullable()
    .optional(),
  objeto: z.string().nullable().optional(),
  valorEstimado: z.coerce.number().nullable().optional(),
  dataAbertura: z.string().nullable().optional(),
  regimeExecucao: z.string().nullable().optional(),
  criterioJulgamento: z.string().nullable().optional(),
  prazoExecucaoMeses: z.coerce.number().int().nullable().optional(),
  leiRegente: z.string().nullable().optional(),
  admiteConsorcio: z.boolean().nullable().optional(),
  exigeSubcontratacao: z.boolean().default(false),
  subcontratacaoPercentualMax: z.coerce.number().nullable().optional(),
  trataFavorecidoMeEpp: z.boolean().default(false),
  sicafSubstituiDocumentos: z.boolean().default(false),
  observacoesExtraidas: z.string().nullable().optional(),
})

export const EditalExtractionResponseSchema = z.object({
  metadata: MetadataSchema,
  habilitacaoJuridica: z.array(HabilitacaoJuridicaItemSchema).default([]),
  regularidadeFiscal: z.array(RegularidadeFiscalItemSchema).default([]),
  qualificacaoTecnica: QualificacaoTecnicaSchema.nullable().optional(),
  profissionais: z.array(ProfissionalItemSchema).default([]),
  parcelasRelevancia: z.array(ParcelaRelevanciaItemSchema).default([]),
  atestadosProfissionais: z.array(AtestadoProfissionalItemSchema).default([]),
  qualificacaoFinanceira: QualificacaoFinanceiraSchema.nullable().optional(),
  declaracoes: z.array(DeclaracaoItemSchema).default([]),
  declaracoesEspeciais: z.array(DeclaracaoEspecialItemSchema).default([]),
  alertas: z.array(AlertaItemSchema).default([]),
  anexosReferenciados: z.array(AnexoReferenciadoItemSchema).default([]),
})

export type EditalExtractionResponse = z.infer<typeof EditalExtractionResponseSchema>
