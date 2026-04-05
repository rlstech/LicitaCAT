// Script one-shot para enfileirar o job de re-embedding
// Roda via: node enqueue-reembed.mjs
import { Queue } from 'bullmq'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

const reembedBatchQueue = new Queue('reembed_batch', {
  connection,
  defaultJobOptions: { attempts: 1 },
})

const job = await reembedBatchQueue.add('reembed-all', {
  batchSize: 100,
  entityTypes: ['cat', 'cat_item', 'parcela_relevancia'],
})

console.log(`✅ Job enfileirado: id=${job.id} queue=reembed_batch`)
console.log('   entityTypes: cat, cat_item, parcela_relevancia')
console.log('   batchSize: 100')

await reembedBatchQueue.close()
process.exit(0)
