import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const tenantPlanEnum = pgEnum('tenant_plan', [
  'starter',
  'professional',
  'enterprise',
])

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'analyst',
  'viewer',
])

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 300 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  plan: tenantPlanEnum('plan').notNull().default('starter'),
  maxEditaisPerMonth: integer('max_editais_per_month').notNull().default(10),
  maxCatsStored: integer('max_cats_stored').notNull().default(100),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 300 }).notNull(),
  role: userRoleEnum('role').notNull().default('analyst'),
  authProviderId: varchar('auth_provider_id', { length: 255 }).notNull().unique(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: text('entity_id').notNull(),
  metadata: text('metadata'), // JSON string
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
