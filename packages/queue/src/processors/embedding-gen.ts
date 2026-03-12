import { Worker, type Job } from 'bullmq'
import { db } from '@licitacat/db'
import { processingJobs } from '@licitacat/db/schema'
import { generateEmbedding } from '@licitacat/ai/embeddings'
import { sql, eq } from 'drizzle-orm'
import type { EmbeddingGenJobData } from '../queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

async function processEmbeddingGen(job: Job<EmbeddingGenJobData>): Promise<void> {
  const { tenantId, entityType, entityId, text, jobId } = job.data

  // Mark job as running
  await db
    .update(processingJobs)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(processingJobs.id, jobId))

  try {
    const { embedding, costUsd } = await generateEmbedding(text, 'document')
    // The embedding column is added via raw SQL migration and is not in the Drizzle schema,
    // so we must use db.execute() with a raw SQL query to update it.
    const embeddingLiteral = `[${embedding.join(',')}]`

    if (entityType === 'edital_requisito') {
      await db.execute(
        sql`UPDATE edital_requisitos SET embedding = ${embeddingLiteral}::vector WHERE id = ${entityId}`,
      )
    } else if (entityType === 'cat') {
      await db.execute(
        sql`UPDATE cats SET embedding = ${embeddingLiteral}::vector WHERE id = ${entityId}`,
      )
    } else if (entityType === 'cat_item') {
      await db.execute(
        sql`UPDATE cat_itens SET embedding = ${embeddingLiteral}::vector WHERE id = ${entityId}`,
      )
    } else if (entityType === 'parcela_relevancia') {
      await db.execute(
        sql`UPDATE req_parcelas_relevancia SET embedding = ${embeddingLiteral}::vector WHERE id = ${entityId}`,
      )
    }

    await db
      .update(processingJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        costUsd: costUsd.toFixed(6),
      })
      .where(eq(processingJobs.id, jobId))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const currentJob = await db.query.processingJobs.findFirst({
      where: eq(processingJobs.id, jobId),
    })

    const attemptCount = (currentJob?.attemptCount ?? 0) + 1
    const status = attemptCount >= 3 ? 'failed' : 'retrying'

    await db
      .update(processingJobs)
      .set({ status, errorMessage, attemptCount })
      .where(eq(processingJobs.id, jobId))

    throw error
  }
}

export function createEmbeddingGenWorker(): Worker<EmbeddingGenJobData> {
  return new Worker<EmbeddingGenJobData>(
    'embedding_gen',
    processEmbeddingGen,
    {
      connection,
      concurrency: 10,
    },
  )
}
