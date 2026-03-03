import {
    createOcrWorker,
    createEditalExtractionWorker,
    createCatExtractionWorker,
    createEmbeddingGenWorker,
} from './processors/index.js'

console.log('🚀 Starting LicitaCAT workers...')

const ocrWorker = createOcrWorker()
const editalExtractionWorker = createEditalExtractionWorker()
const catExtractionWorker = createCatExtractionWorker()
const embeddingGenWorker = createEmbeddingGenWorker()

const workers = [ocrWorker, editalExtractionWorker, catExtractionWorker, embeddingGenWorker]

// Logging
for (const worker of workers) {
    worker.on('completed', (job) => {
        console.log(`✅ [${worker.name}] Job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
        console.error(`❌ [${worker.name}] Job ${job?.id} failed:`, err.message)
    })

    console.log(`  ✓ Worker "${worker.name}" ready`)
}

// Graceful shutdown
async function shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down workers...')
    await Promise.all(workers.map((w) => w.close()))
    console.log('👋 Workers stopped.')
    process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log('🎯 All workers running. Waiting for jobs...')
