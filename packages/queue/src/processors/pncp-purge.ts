import { Worker } from 'bullmq'
import { db } from '@licitacat/db'
import { pncpCache, pncpSyncConfig } from '@licitacat/db/schema'
import { eq, sql, lt, max } from 'drizzle-orm'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

const DEFAULT_RETENTION_DAYS = 90

async function processPncpPurge(): Promise<void> {
  // Calcula retenção máxima entre todos os tenants ativos
  const [result] = await db
    .select({ maxRetention: max(pncpSyncConfig.retentionDays) })
    .from(pncpSyncConfig)
    .where(eq(pncpSyncConfig.isActive, true))

  const retentionDays = result?.maxRetention ?? DEFAULT_RETENTION_DAYS

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  const deleted = await db.delete(pncpCache)
    .where(lt(pncpCache.syncedAt, cutoff))
    .returning({ id: pncpCache.id })

  if (deleted.length > 0) {
    console.log(`🗑️  [pncp-purge] Removidos ${deleted.length} registros com synced_at < ${cutoff.toISOString()}`)
  }
}

export function createPncpPurgeWorker(): Worker {
  return new Worker('pncp_purge', processPncpPurge, {
    connection,
    concurrency: 1,
  })
}
