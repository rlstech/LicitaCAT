import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants, users } from './tenants.js'



export const editalStatusEnum = pgEnum('edital_status', [
  'uploaded',
  'ocr_processing',
  'extracting',
  'review_pending',
  'ready',
  'error',
])

export const pdfTypeEnum = pgEnum('pdf_type', [
  'copyable',
  'scanned',
  'mixed',
])

export const modalidadeEnum = pgEnum('modalidade_licitacao', [
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

export const requisitoStatusEnum = pgEnum('requisito_status', [
  'ai_extracted',
  'human_approved',
  'human_edited',
  'human_rejected',
])

export const requisitoCategoriaEnum = pgEnum('requisito_categoria', [
  'qualificacao_tecnica',
  'qualificacao_economica',
  'regularidade_fiscal',
  'habilitacao_juridica',
  'habilitacao_fiscal_social_trabalhista',
  'qualificacao_economico_financeira',
  'qualificacao_tecnico_operacional',
  'qualificacao_tecnico_profissional',
  'declaracoes_outros',
  'outro',
])

export const editais = pgTable('editais', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  uploadedBy: text('uploaded_by')
    .notNull()
    .references(() => users.id),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: text('file_url').notNull(),
  pageCount: integer('page_count'),
  pdfType: pdfTypeEnum('pdf_type'),
  status: editalStatusEnum('status').notNull().default('uploaded'),
  orgaoLicitante: varchar('orgao_licitante', { length: 500 }),
  numeroEdital: varchar('numero_edital', { length: 100 }),
  modalidade: modalidadeEnum('modalidade'),
  objeto: text('objeto'),
  valorEstimado: numeric('valor_estimado', { precision: 15, scale: 2 }),
  dataAbertura: timestamp('data_abertura', { withTimezone: true }),
  aiExtractionCostUsd: numeric('ai_extraction_cost_usd', { precision: 10, scale: 6 }),
  ocrCostUsd: numeric('ocr_cost_usd', { precision: 10, scale: 6 }),
  // New columns added in migration 0002
  uasg: varchar('uasg', { length: 20 }),
  regimeExecucao: varchar('regime_execucao', { length: 100 }),
  criterioJulgamento: varchar('criterio_julgamento', { length: 100 }),
  prazoExecucaoMeses: integer('prazo_execucao_meses'),
  leiRegente: varchar('lei_regente', { length: 100 }),
  admiteConsorcio: boolean('admite_consorcio'),
  exigeSubcontratacao: boolean('exige_subcontratacao').notNull().default(false),
  subcontratacaoPercentualMax: numeric('subcontratacao_percentual_max', { precision: 5, scale: 2 }),
  trataFavorecidoMeEpp: boolean('trata_favorecido_me_epp').notNull().default(false),
  sicafSubstituiDocumentos: boolean('sicaf_substitui_documentos').notNull().default(false),
  observacoesExtraidas: text('observacoes_extraidas'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('editais_tenant_id_idx').on(table.tenantId),
  tenantStatusIdx: index('editais_tenant_status_idx').on(table.tenantId, table.status),
}))

export const editalRequisitos = pgTable('edital_requisitos', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id')
    .notNull()
    .references(() => editais.id, { onDelete: 'cascade' }),
  lote: varchar('lote', { length: 100 }),
  categoria: requisitoCategoriaEnum('categoria').notNull().default('qualificacao_tecnica'),
  descricao: text('descricao').notNull(),
  trechoOriginal: text('trecho_original'),
  paginaReferencia: integer('pagina_referencia'),
  quantitativoExigido: numeric('quantitativo_exigido', { precision: 15, scale: 4 }),
  unidade: varchar('unidade', { length: 50 }),
  referenciaAnexo: varchar('referencia_anexo', { length: 100 }),
  aiConfidenceScore: integer('ai_confidence_score').notNull().default(0),
  status: requisitoStatusEnum('status').notNull().default('ai_extracted'),
  editedBy: text('edited_by').references(() => users.id),
  // embedding VECTOR(1536) — added via raw SQL migration
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantEditalIdx: index('edital_requisitos_tenant_edital_idx').on(table.tenantId, table.editalId),
  confidenceIdx: index('edital_requisitos_confidence_idx').on(table.aiConfidenceScore),
}))
