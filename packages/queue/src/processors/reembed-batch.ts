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

async function fetchPendingRows(entityType: EntityType, batchSize: number): Promise<PendingRow[]> {
  const condition = sql`embedding_model IS NULL OR embedding_model != ${CURRENT_EMBEDDING_MODEL}`

  if (entityType === 'cat') {
    const rows = await db.execute(sql`
      SELECT id, coalesce(descricao_tecnica, '') as text
      FROM cats
      WHERE ${condition}
        AND embedding IS NOT NULL
      LIMIT ${batchSize}
    `)
    return Array.from(rows as unknown as Iterable<Record<string, unknown>>)
      .map(r => ({ id: String(r['id']), text: String(r['text'] ?? '') }))
  }

  if (entityType === 'cat_item') {
    const rows = await db.execute(sql`
      SELECT id, coalesce(descricao, '') as text
      FROM cat_itens
      WHERE ${condition}
        AND embedding IS NOT NULL
      LIMIT ${batchSize}
    `)
    return Array.from(rows as unknown as Iterable<Record<string, unknown>>)
      .map(r => ({ id: String(r['id']), text: String(r['text'] ?? '') }))
  }

  if (entityType === 'edital_requisito') {
    const rows = await db.execute(sql`
      SELECT id, coalesce(descricao, '') as text
      FROM edital_requisitos
      WHERE ${condition}
        AND embedding IS NOT NULL
      LIMIT ${batchSize}
    `)
    return Array.from(rows as unknown as Iterable<Record<string, unknown>>)
      .map(r => ({ id: String(r['id']), text: String(r['text'] ?? '') }))
  }

  // parcela_relevancia
  const rows = await db.execute(sql`
    SELECT id, coalesce(servico, '') as text
    FROM req_parcelas_relevancia
    WHERE ${condition}
      AND embedding IS NOT NULL
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
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const rows = await fetchPendingRows(entityType, batchSize)

      if (rows.length === 0) {
        hasMore = false
        break
      }

      // Enqueue embedding_gen jobs for this batch
      const jobs = rows.map(row => ({
        name: `reembed-${entityType}-${row.id}`,
        data: {
          tenantId: 'reembed', // embedding-gen uses raw SQL with entityId only, tenantId not used in query
          entityType: entityType as 'edital_requisito' | 'cat' | 'cat_item' | 'parcela_relevancia',
          entityId: row.id,
          text: row.text,
          jobId: `reembed-${entityType}-${row.id}`,
        },
      }))

      await embeddingGenQueue.addBulk(jobs)
      totalEnqueued += rows.length
      offset += rows.length

      console.log(`[reembed-batch] Enqueued ${rows.length} ${entityType} jobs (total so far: ${totalEnqueued})`)

      if (rows.length < batchSize) {
        hasMore = false
      } else {
        // Throttle to avoid overwhelming the queue and Gemini rate limits
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    console.log(`[reembed-batch] ${entityType}: done. Total enqueued for this type: ${offset}`)
  }

  console.log(`[reembed-batch] Batch complete. Total jobs enqueued: ${totalEnqueued}`)
}

export function createReembedBatchWorker(): Worker<ReembedBatchJobData> {
  return new Worker<ReembedBatchJobData>('reembed_batch', processReembedBatch, {
    connection,
    concurrency: 1,
  })
}
