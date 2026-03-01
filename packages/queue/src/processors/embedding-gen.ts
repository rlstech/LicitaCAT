import { Worker, type Job } from 'bullmq'
import { db } from '@licitacat/db'
import { editalRequisitos, cats, catItens, processingJobs } from '@licitacat/db/schema'
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
    const embeddingVector = `[${embedding.join(',')}]`

    if (entityType === 'edital_requisito') {
      await db
        .update(editalRequisitos)
        .set({ embedding: sql`${embeddingVector}::vector` })
        .where(eq(editalRequisitos.id, entityId))
    } else if (entityType === 'cat') {
      await db
        .update(cats)
        .set({ embedding: sql`${embeddingVector}::vector` })
        .where(eq(cats.id, entityId))
    } else if (entityType === 'cat_item') {
      await db
        .update(catItens)
        .set({ embedding: sql`${embeddingVector}::vector` })
        .where(eq(catItens.id, entityId))
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
