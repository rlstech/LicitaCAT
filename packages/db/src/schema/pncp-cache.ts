import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants.js'

// ─── pncp_cache (global — dados públicos, sem RLS por tenant) ─────────────
export const pncpCache = pgTable('pncp_cache', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),

  // Chave natural do PNCP
  anoCompra:          integer('ano_compra').notNull(),
  sequencialCompra:   varchar('sequencial_compra', { length: 20 }).notNull(),
  cnpjOrgao:          varchar('cnpj_orgao', { length: 18 }).notNull(),

  // Campos filtráveis
  uf:                     varchar('uf', { length: 2 }).notNull(),
  codigoMunicipioIbge:    varchar('codigo_municipio_ibge', { length: 7 }),
  nomeMunicipio:          varchar('nome_municipio', { length: 200 }),
  razaoSocial:            varchar('razao_social', { length: 500 }),
  codigoModalidade:       integer('codigo_modalidade').notNull(),
  modalidadeNome:         varchar('modalidade_nome', { length: 200 }),
  objeto:                 text('objeto'),
  valorTotalEstimado:     numeric('valor_total_estimado', { precision: 15, scale: 2 }),
  dataPublicacaoPncp:     date('data_publicacao_pncp').notNull(),
  dataAberturaProposta:   timestamp('data_abertura_proposta', { withTimezone: true }),
  situacaoCompraId:       integer('situacao_compra_id'),
  situacaoCompraNome:     varchar('situacao_compra_nome', { length: 100 }),
  linkSistemaOrigem:      text('link_sistema_origem'),

  // Resposta bruta completa do PNCP
  rawData: jsonb('raw_data').notNull(),

  // Metadados de sync
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  naturalKeyIdx:   uniqueIndex('pncp_cache_natural_key').on(table.anoCompra, table.sequencialCompra, table.cnpjOrgao),
  ufIdx:           index('pncp_cache_uf_idx').on(table.uf),
  modalidadeIdx:   index('pncp_cache_modalidade_idx').on(table.codigoModalidade),
  dataPubIdx:      index('pncp_cache_data_pub_idx').on(table.dataPublicacaoPncp),
  municipioIdx:    index('pncp_cache_municipio_idx').on(table.codigoMunicipioIbge),
  valorIdx:        index('pncp_cache_valor_idx').on(table.valorTotalEstimado),
  syncedAtIdx:     index('pncp_cache_synced_at_idx').on(table.syncedAt),
}))

export type PncpCacheRecord = typeof pncpCache.$inferSelect
export type NewPncpCacheRecord = typeof pncpCache.$inferInsert

// ─── pncp_sync_config (por tenant) ────────────────────────────────────────
export const pncpSyncConfig = pgTable('pncp_sync_config', {
  id:       text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  ufs:           text('ufs').array().notNull().default(sql`'{}'`),
  modalidades:   integer('modalidades').array().notNull().default(sql`'{}'`),
  retentionDays: integer('retention_days').notNull().default(90),
  isActive:      boolean('is_active').notNull().default(true),

  lastSyncedAt:    timestamp('last_synced_at', { withTimezone: true }),
  lastSyncStatus:  varchar('last_sync_status', { length: 20 }),
  lastSyncError:   text('last_sync_error'),
  lastSyncJobId:   text('last_sync_job_id'),
  recordsSynced:   integer('records_synced'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantUniqueIdx: uniqueIndex('pncp_sync_config_tenant_unique').on(table.tenantId),
  activeIdx:       index('pncp_sync_config_active_idx').on(table.isActive),
}))

export type PncpSyncConfig = typeof pncpSyncConfig.$inferSelect
export type NewPncpSyncConfig = typeof pncpSyncConfig.$inferInsert
