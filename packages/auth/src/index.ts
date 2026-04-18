import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@licitacat/db'
import * as schema from '@licitacat/db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.baUser,
      session: schema.baSession,
      account: schema.baAccount,
      verification: schema.baVerification,
    },
  }),
  emailAndPassword: { enabled: true },
  secret: process.env['BETTER_AUTH_SECRET'] ?? 'build-placeholder',
  baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000',
  trustedOrigins: [
    'https://licitacat.railton.eu.org',
    'https://api.licitacat.railton.eu.org',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
})

export type Auth = typeof auth
