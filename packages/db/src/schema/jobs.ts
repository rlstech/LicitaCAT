import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants.js'

export const jobTypeEnum = pgEnum('job_type', [
  'ocr',
  'edital_extraction',
  'cat_extraction',
  'crossing',
  'embedding_gen',
])

export const jobStatusEnum = pgEnum('job_status', [
  'queued',
  'running',
  'completed',
  'failed',
  'retrying',
])

export const jobEntityTypeEnum = pgEnum('job_entity_type', [
  'edital',
  'cat',
  'crossing',
])

export const processingJobs = pgTable('processing_jobs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  jobType: jobTypeEnum('job_type').notNull(),
  entityType: jobEntityTypeEnum('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  status: jobStatusEnum('status').notNull().default('queued'),
  attemptCount: integer('attempt_count').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantStatusIdx: index('processing_jobs_tenant_status_idx').on(table.tenantId, table.status),
  entityIdx: index('processing_jobs_entity_idx').on(table.entityType, table.entityId),
}))
