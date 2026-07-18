import { Worker, type Job } from 'bullmq'
import { db } from '@licitacat/db'
import { sql } from 'drizzle-orm'
import { embeddingGenQueue } from '../queues/index.js'
import { CURRENT_EMBEDDING_MODEL } from '@licitacat/ai/embeddings'
import type { ReembedBatchJobData } from '../queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const DEFAULT_BATCH_SIZE = 100
// Delay between enqueuing batches to respect Gemini rate limits
const BATCH_DELAY_MS = 500

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

type EntityType = 'cat' | 'cat_item' | 'edital_requisito' | 'parcela_relevancia'

interface PendingRow {
  id: string
  text: string
}

// Table + text column for each entity type.
const SOURCE: Record<EntityType, { table: string; textCol: string }> = {
  cat: { table: 'cats', textCol: 'descricao_tecnica' },
  cat_item: { table: 'cat_itens', textCol: 'descricao' },
  edital_requisito: { table: 'edital_requisitos', textCol: 'descricao' },
  parcela_relevancia: { table: 'req_parcelas_relevancia', textCol: 'servico' },
}

/**
 * Fetch a page of rows still on an outdated embedding model, using KEYSET
 * pagination by `id` (cursor = `afterId`).
 *
 * Why keyset and not plain LIMIT: `embedding_gen` re-embeds rows asynchronously,
 * so rows leave the "pending" set (embedding_model flips) while we iterate. A
 * bare `LIMIT batchSize` re-reads the same still-pending rows every iteration
 * and re-enqueues them in a runaway loop (once enqueued tens of thousands of
 * duplicate jobs). Walking forward by `id > afterId ORDER BY id` visits each
 * pending row at most once and never revisits rows we've already passed.
 */
async function fetchPendingRows(
  entityType: EntityType,
  batchSize: number,
  afterId: string,
): Promise<PendingRow[]> {
  const { table, textCol } = SOURCE[entityType]
  const rows = await db.execute(sql`
    SELECT id, coalesce(${sql.raw(textCol)}, '') as text
    FROM ${sql.raw(table)}
    WHERE (embedding_model IS NULL OR embedding_model != ${CURRENT_EMBEDDING_MODEL})
      AND embedding IS NOT NULL
      AND id > ${afterId}
    ORDER BY id
    LIMIT ${batchSize}
  `)
  return Array.from(rows as unknown as Iterable<Record<string, unknown>>)
    .map(r => ({ id: String(r['id']), text: String(r['text'] ?? '') }))
}

async function processReembedBatch(job: Job<ReembedBatchJobData>): Promise<void> {
  const batchSize = job.data.batchSize ?? DEFAULT_BATCH_SIZE
  const entityTypes: EntityType[] = job.data.entityTypes ?? ['cat', 'cat_item', 'edital_requisito', 'parcela_relevancia']

  let totalEnqueued = 0

  for (const entityType of entityTypes) {
    let enqueuedForType = 0
    // Empty string sorts before every uuid, so the first page starts at the beginning.
    let afterId = ''
    let hasMore = true

    while (hasMore) {
      const rows = await fetchPendingRows(entityType, batchSize, afterId)

      if (rows.length === 0) {
        hasMore = false
        break
      }

      // Enqueue one embedding_gen job per row. We deliberately do NOT set a
      // BullMQ opts.jobId here: a deterministic jobId dedups against *completed*
      // jobs still retained in Redis from a previous run, silently skipping rows
      // that legitimately need re-embedding again (e.g. a later model switch).
      // Keyset pagination already guarantees one enqueue per row per run, and the
      // reembed_batch worker runs with concurrency 1 (no overlapping runs), so no
      // dedup is needed.
      const jobs = rows.map(row => ({
        name: `reembed-${entityType}-${row.id}`,
        data: {
          tenantId: 'reembed', // embedding-gen queries by entityId only; tenantId unused
          entityType,
          entityId: row.id,
          text: row.text,
          jobId: `reembed-${entityType}-${row.id}`,
        },
      }))

      await embeddingGenQueue.addBulk(jobs)
      totalEnqueued += rows.length
      enqueuedForType += rows.length
      // Advance the cursor past the last row of this page.
      afterId = rows[rows.length - 1]!.id

      console.log(`[reembed-batch] Enqueued ${rows.length} ${entityType} jobs (total so far: ${totalEnqueued})`)

      if (rows.length < batchSize) {
        hasMore = false
      } else {
        // Throttle to avoid overwhelming the queue and Gemini rate limits
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    console.log(`[reembed-batch] ${entityType}: done. Total enqueued for this type: ${enqueuedForType}`)
  }

  console.log(`[reembed-batch] Batch complete. Total jobs enqueued: ${totalEnqueued}`)
}

export function createReembedBatchWorker(): Worker<ReembedBatchJobData> {
  return new Worker<ReembedBatchJobData>('reembed_batch', processReembedBatch, {
    connection,
    concurrency: 1,
  })
}
