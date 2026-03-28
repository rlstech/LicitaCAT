import {
    createEditalExtractionWorker,
    createCatExtractionWorker,
    createCrossingWorker,
    createEmbeddingGenWorker,
    createPncpSyncWorker,
    createPncpPurgeWorker,
} from './processors/index.js'
import { registerPncpSchedules } from './scheduler.js'

console.log('🚀 Starting LicitaCAT workers...')

const editalExtractionWorker = createEditalExtractionWorker()
const catExtractionWorker = createCatExtractionWorker()
const crossingWorker = createCrossingWorker()
const embeddingGenWorker = createEmbeddingGenWorker()
const pncpSyncWorker = createPncpSyncWorker()
const pncpPurgeWorker = createPncpPurgeWorker()

const workers = [
    editalExtractionWorker,
    catExtractionWorker,
    crossingWorker,
    embeddingGenWorker,
    pncpSyncWorker,
    pncpPurgeWorker,
]

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

// Registrar schedules do PNCP
registerPncpSchedules().catch(err => {
    console.error('⚠️  Erro ao registrar PNCP schedules:', err)
})

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
