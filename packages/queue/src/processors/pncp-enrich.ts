import { Worker, type Job } from 'bullmq'
import { db } from '@licitacat/db'
import { pncpCache } from '@licitacat/db/schema'
import { getPncpDetalhe } from '@licitacat/shared/pncp'
import { eq, desc, sql } from 'drizzle-orm'
import type { PncpEnrichJobData } from '../queues/index.js'
import { pncpClassifyQueue } from '../queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

const DELAY_BETWEEN_CALLS_MS = 300
const DEFAULT_BATCH_SIZE = 100

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function processPncpEnrich(job: Job<PncpEnrichJobData>): Promise<void> {
  const batchSize = job.data.batchSize ?? DEFAULT_BATCH_SIZE

  // Buscar records pendentes, priorizando os com data de abertura mais próxima
  const pending = await db.select({
    id: pncpCache.id,
    cnpjOrgao: pncpCache.cnpjOrgao,
    anoCompra: pncpCache.anoCompra,
    sequencialCompra: pncpCache.sequencialCompra,
  })
    .from(pncpCache)
    .where(eq(pncpCache.enrichStatus, 'pending'))
    .orderBy(desc(pncpCache.dataAberturaProposta))
    .limit(batchSize)

  if (pending.length === 0) {
    console.log('[pncp-enrich] Nenhum registro pendente.')
    return
  }

  console.log(`[pncp-enrich] Enriquecendo ${pending.length} registros...`)
  let enriched = 0
  let failed = 0

  for (const record of pending) {
    try {
      const detalhe = await getPncpDetalhe(
        record.cnpjOrgao,
        record.anoCompra,
        record.sequencialCompra,
      )

      await db.update(pncpCache)
        .set({
          dataEncerramentoProposta: detalhe.dataEncerramentoProposta
            ? new Date(detalhe.dataEncerramentoProposta)
            : null,
          enrichStatus: 'done',
        })
        .where(eq(pncpCache.id, record.id))

      enriched++
    } catch (err) {
      console.warn(
        `[pncp-enrich] Erro ao enriquecer ${record.cnpjOrgao}/${record.anoCompra}/${record.sequencialCompra}:`,
        err instanceof Error ? err.message : err,
      )

      await db.update(pncpCache)
        .set({ enrichStatus: 'failed' })
        .where(eq(pncpCache.id, record.id))

      failed++
    }

    await job.updateProgress(Math.round(((enriched + failed) / pending.length) * 100))
    await sleep(DELAY_BETWEEN_CALLS_MS)
  }

  console.log(`[pncp-enrich] Concluído: ${enriched} enriquecidos, ${failed} falhas.`)

  if (enriched > 0) {
    await pncpClassifyQueue.add('post_enrich_classify', {})
  }
}

export function createPncpEnrichWorker(): Worker<PncpEnrichJobData> {
  return new Worker<PncpEnrichJobData>('pncp_enrich', processPncpEnrich, {
    connection,
    concurrency: 1,
    lockDuration: 600000,   // 10 min
    lockRenewTime: 240000,  // renova a cada 4 min
  })
}
