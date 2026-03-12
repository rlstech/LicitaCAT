import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants.js'
import { editais } from './editais.js'

export const alertaNivelEnum = pgEnum('alerta_nivel', [
  'critico',
  'atencao',
  'informacao',
])

export const reqHabilitacaoJuridica = pgTable('req_habilitacao_juridica', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  documento: text('documento').notNull(),
  aplicaA: varchar('aplica_a', { length: 200 }),
  observacao: text('observacao'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reqRegularidadeFiscal = pgTable('req_regularidade_fiscal', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  documento: text('documento').notNull(),
  sigla: varchar('sigla', { length: 50 }),
  validadeDias: integer('validade_dias'),
  observacao: text('observacao'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reqQualificacaoTecnica = pgTable('req_qualificacao_tecnica', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().unique().references(() => editais.id, { onDelete: 'cascade' }),
  registroConselho: varchar('registro_conselho', { length: 200 }),
  exigeVisitaTecnica: boolean('exige_visita_tecnica').notNull().default(false),
  visitaTipo: varchar('visita_tipo', { length: 100 }),
  exigeEscritorioLocal: boolean('exige_escritorio_local').notNull().default(false),
  escritorioDescricao: text('escritorio_descricao'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reqProfissionais = pgTable('req_profissionais', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  cargo: text('cargo').notNull(),
  conselho: varchar('conselho', { length: 50 }),
  quantidade: integer('quantidade'),
  cbo: varchar('cbo', { length: 20 }),
  observacao: text('observacao'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reqParcelasRelevancia = pgTable('req_parcelas_relevancia', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  servico: text('servico').notNull(),
  unidade: varchar('unidade', { length: 50 }),
  quantidadeMinima: numeric('quantidade_minima', { precision: 15, scale: 4 }),
  observacao: text('observacao'),
  // embedding VECTOR(768) — added via raw SQL migration
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reqAtestadosProfissionais = pgTable('req_atestados_profissionais', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  profissional: text('profissional').notNull(),
  caracteristicasExigidas: text('caracteristicas_exigidas'),
  exigeCat: boolean('exige_cat').notNull().default(false),
  observacao: text('observacao'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reqQualificacaoFinanceira = pgTable('req_qualificacao_financeira', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().unique().references(() => editais.id, { onDelete: 'cascade' }),
  exigeBalanco: boolean('exige_balanco').notNull().default(false),
  balancoExercicios: integer('balanco_exercicios'),
  patrimonioLiquidoMinimo: numeric('patrimonio_liquido_minimo', { precision: 15, scale: 2 }),
  patrimonioPercentualContrato: numeric('patrimonio_percentual_contrato', { precision: 5, scale: 2 }),
  lcMinimo: numeric('lc_minimo', { precision: 5, scale: 2 }),
  lgMinimo: numeric('lg_minimo', { precision: 5, scale: 2 }),
  sgMinimo: numeric('sg_minimo', { precision: 5, scale: 2 }),
  exigeCertidaoFalencia: boolean('exige_certidao_falencia').notNull().default(false),
  certidaoFalenciaPrazoDias: integer('certidao_falencia_prazo_dias'),
  exigeCapitalSocialMinimo: boolean('exige_capital_social_minimo').notNull().default(false),
  capitalSocialMinimo: numeric('capital_social_minimo', { precision: 15, scale: 2 }),
  exigeGarantiaProposta: boolean('exige_garantia_proposta').notNull().default(false),
  garantiaPropostaPercentual: numeric('garantia_proposta_percentual', { precision: 5, scale: 2 }),
  observacao: text('observacao'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reqDeclaracoes = pgTable('req_declaracoes', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  descricao: text('descricao').notNull(),
  baseLegal: varchar('base_legal', { length: 200 }),
  leiEstadual: boolean('lei_estadual').notNull().default(false),
  penalidadeOmissao: text('penalidade_omissao'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reqDeclaracoesEspeciais = pgTable('req_declaracoes_especiais', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  descricao: text('descricao').notNull(),
  lei: varchar('lei', { length: 200 }),
  uf: varchar('uf', { length: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reqAlertas = pgTable('req_alertas', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  nivel: alertaNivelEnum('nivel').notNull(),
  categoria: varchar('categoria', { length: 100 }),
  descricao: text('descricao').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reqAnexosReferenciados = pgTable('req_anexos_referenciados', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  identificacao: varchar('identificacao', { length: 100 }).notNull(),
  descricao: text('descricao'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
