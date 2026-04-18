import { Queue } from 'bullmq'
import { db } from '@licitacat/db'
import { pncpSyncConfig } from '@licitacat/db/schema'
import { eq } from 'drizzle-orm'
import { pncpSyncQueue, pncpEnrichQueue, pncpClassifyQueue, type PncpSyncJobData } from './queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

export const pncpPurgeQueue = new Queue('pncp_purge', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential' as const, delay: 30000 },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 10 },
  },
})

export async function registerPncpSchedules(): Promise<void> {
  const activeConfigs = await db.query.pncpSyncConfig.findMany({
    where: eq(pncpSyncConfig.isActive, true),
  })

  for (const config of activeConfigs) {
    await pncpSyncQueue.add(
      `pncp_sync_${config.tenantId}`,
      { tenantId: config.tenantId, configId: config.id, triggeredBy: 'schedule' } satisfies PncpSyncJobData,
      {
        repeat: { pattern: '0 */4 * * *' },
        jobId: `scheduled_${config.tenantId}`,
      },
    )
  }

  // Enriquecimento a cada hora (preenche dataEncerramentoProposta)
  await pncpEnrichQueue.add(
    'scheduled_enrich',
    {},
    { repeat: { pattern: '*/15 * * * *' }, jobId: 'pncp_enrich_15m' },
  )

  // Classificação de licitações a cada 20 minutos
  await pncpClassifyQueue.add(
    'scheduled_classify',
    {},
    { repeat: { pattern: '*/20 * * * *' }, jobId: 'pncp_classify_20m' },
  )

  // Purge diário às 02:00
  await pncpPurgeQueue.add(
    'daily_purge',
    {},
    { repeat: { pattern: '0 2 * * *' }, jobId: 'pncp_daily_purge' },
  )

  console.log(`  ✓ PNCP schedules registrados (${activeConfigs.length} tenants ativos)`)
}
