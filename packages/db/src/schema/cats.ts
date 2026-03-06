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
import { sql, relations } from 'drizzle-orm'
import { tenants, users } from './tenants.js'

export const conselhoEnum = pgEnum('conselho', ['CREA', 'CAU'])

export const catFileTypeEnum = pgEnum('cat_file_type', [
  'pdf_scanned',
  'pdf_copyable',
  'excel',
  'manual',
])

export const catExtractionStatusEnum = pgEnum('cat_extraction_status', [
  'pending',
  'processing',
  'review_pending',
  'completed',
  'error',
])

export const catItemOrigemEnum = pgEnum('cat_item_origem', [
  'ai_extracted',
  'human_added',
  'excel_imported',
])

export const profissionaisTecnicos = pgTable('profissionais_tecnicos', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  nome: varchar('nome', { length: 300 }).notNull(),
  numeroCreaCau: varchar('numero_crea_cau', { length: 50 }).notNull(),
  conselho: conselhoEnum('conselho').notNull(),
  ufRegistro: varchar('uf_registro', { length: 2 }).notNull(),
  ativo: boolean('ativo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index('profissionais_tenant_idx').on(table.tenantId),
}))

export const cats = pgTable('cats', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  profissionalId: text('profissional_id')
    .notNull()
    .references(() => profissionaisTecnicos.id, { onDelete: 'restrict' }),
  uploadedBy: text('uploaded_by')
    .notNull()
    .references(() => users.id),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: catFileTypeEnum('file_type').notNull(),
  numeroCat: varchar('numero_cat', { length: 100 }),
  empresaContratante: varchar('empresa_contratante', { length: 500 }),
  tipoObraServico: varchar('tipo_obra_servico', { length: 500 }),
  descricaoTecnica: text('descricao_tecnica'),
  quantitativoValor: numeric('quantitativo_valor', { precision: 15, scale: 4 }),
  quantitativoUnidade: varchar('quantitativo_unidade', { length: 50 }),
  dataInicio: timestamp('data_inicio', { withTimezone: true }),
  dataConclusao: timestamp('data_conclusao', { withTimezone: true }),
  statusExtracao: catExtractionStatusEnum('status_extracao').notNull().default('pending'),
  aiConfidenceScore: integer('ai_confidence_score'),
  // embedding VECTOR(1536) — added via raw SQL migration
  ativo: boolean('ativo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index('cats_tenant_idx').on(table.tenantId),
  tenantTipoIdx: index('cats_tenant_tipo_idx').on(table.tenantId, table.tipoObraServico),
}))

export const catsRelations = relations(cats, ({ one }) => ({
  profissional: one(profissionaisTecnicos, {
    fields: [cats.profissionalId],
    references: [profissionaisTecnicos.id],
  }),
}))

export const catItens = pgTable('cat_itens', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  catId: text('cat_id')
    .notNull()
    .references(() => cats.id, { onDelete: 'cascade' }),
  numeroItem: integer('numero_item'),
  descricao: text('descricao').notNull(),
  unidade: varchar('unidade', { length: 50 }),
  quantidade: numeric('quantidade', { precision: 15, scale: 4 }),
  origem: catItemOrigemEnum('origem').notNull().default('ai_extracted'),
  aiConfidenceScore: integer('ai_confidence_score'),
  // embedding VECTOR(1536) — added via raw SQL migration
  ordem: integer('ordem').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantCatIdx: index('cat_itens_tenant_cat_idx').on(table.tenantId, table.catId),
}))
