import {
  pgTable,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants, users } from './tenants.js'
import { editais } from './editais.js'
import { cats, catItens } from './cats.js'
import { reqParcelasRelevancia } from './edital-habilitacao.js'

export const crossingStatusEnum = pgEnum('crossing_status', [
  'queued',
  'processing',
  'completed',
  'error',
])

export const recomendacaoEnum = pgEnum('recomendacao', [
  'participar',
  'participar_com_ressalvas',
  'nao_participar',
])

export const crossingItemResultadoEnum = pgEnum('crossing_item_resultado', [
  'atendido',
  'atendido_parcialmente',
  'gap',
])

export const nivelMatchEnum = pgEnum('nivel_match', ['cat', 'item'])

export const avaliacaoLlmEnum = pgEnum('avaliacao_llm', [
  'atende',
  'atende_parcialmente',
  'nao_atende',
])

export const crossings = pgTable('crossings', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id')
    .notNull()
    .references(() => editais.id, { onDelete: 'cascade' }),
  triggeredBy: text('triggered_by')
    .notNull()
    .references(() => users.id),
  status: crossingStatusEnum('status').notNull().default('queued'),
  scoreAderencia: integer('score_aderencia'),
  totalRequisitos: integer('total_requisitos'),
  requisitosAtendidos: integer('requisitos_atendidos'),
  requisitosComRessalva: integer('requisitos_com_ressalva'),
  requisitosGap: integer('requisitos_gap'),
  recomendacao: recomendacaoEnum('recomendacao'),
  recomendacaoJustificativa: text('recomendacao_justificativa'),
  aiCostUsd: numeric('ai_cost_usd', { precision: 10, scale: 6 }),
  processingTimeSeconds: integer('processing_time_seconds'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantEditalIdx: index('crossings_tenant_edital_idx').on(table.tenantId, table.editalId),
}))

export const crossingItems = pgTable('crossing_items', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  crossingId: text('crossing_id')
    .notNull()
    .references(() => crossings.id, { onDelete: 'cascade' }),
  requisitoId: text('requisito_id')
    .notNull()
    .references(() => reqParcelasRelevancia.id),
  resultado: crossingItemResultadoEnum('resultado').notNull(),
  aiJustificativa: text('ai_justificativa'),
  scoreSimilaridadeMax: numeric('score_similaridade_max', { precision: 5, scale: 4 }),
  humanOverride: boolean('human_override').notNull().default(false),
  humanOverrideBy: text('human_override_by').references(() => users.id),
  humanOverrideNote: text('human_override_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crossingItemCats = pgTable('crossing_item_cats', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  crossingItemId: text('crossing_item_id')
    .notNull()
    .references(() => crossingItems.id, { onDelete: 'cascade' }),
  catId: text('cat_id')
    .notNull()
    .references(() => cats.id),
  catItemId: text('cat_item_id').references(() => catItens.id),
  nivelMatch: nivelMatchEnum('nivel_match').notNull(),
  scoreSimilaridade: numeric('score_similaridade', { precision: 5, scale: 4 }).notNull(),
  avaliacaoLlm: avaliacaoLlmEnum('avaliacao_llm').notNull(),
  justificativaLlm: text('justificativa_llm').notNull(),
  rankPosicao: integer('rank_posicao').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
