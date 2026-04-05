/**
 * Script direto de re-embedding sem BullMQ.
 * Atualiza todos os rows com embedding_model NULL ou diferente do modelo atual.
 * Roda via: node direct-reembed.mjs
 */
// Use the postgres package available in the container
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const postgres = require('postgres')

const DATABASE_URL = process.env['DATABASE_URL']
if (!DATABASE_URL) throw new Error('DATABASE_URL env required')

const sql = postgres(DATABASE_URL, { max: 5 })

const GEMINI_API_KEY = process.env['GEMINI_API_KEY']
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY env required')

const EMBEDDING_MODEL = 'gemini-embedding-2-preview'
const EMBEDDING_DIMENSIONS = 768
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`
const CONCURRENCY = 5
const BATCH_SIZE = 50


async function generateEmbedding(text) {
  const response = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }
  const data = await response.json()
  return data.embedding.values
}

async function processRow(table, textCol, row) {
  const text = row[textCol] || ''
  if (!text.trim()) return false
  try {
    const embedding = await generateEmbedding(text)
    const embeddingStr = `[${embedding.join(',')}]`
    await sql.unsafe(
      `UPDATE ${table} SET embedding = '${embeddingStr}'::vector, embedding_model = '${EMBEDDING_MODEL}' WHERE id = '${row.id}'`
    )
    return true
  } catch (err) {
    console.error(`  ✗ ${table} ${row.id}: ${err.message}`)
    return false
  }
}

async function processTable(table, textCol) {
  const [{ count }] = await sql.unsafe(
    `SELECT count(*)::int as count FROM ${table} WHERE embedding_model IS NULL OR embedding_model != '${EMBEDDING_MODEL}'`
  )
  const total = count
  console.log(`\n📋 ${table}: ${total} rows para atualizar`)
  if (total === 0) return

  let done = 0
  let errors = 0

  // Keep fetching until no more rows to update
  while (true) {
    const rows = await sql.unsafe(
      `SELECT id, ${textCol} FROM ${table} WHERE embedding_model IS NULL OR embedding_model != '${EMBEDDING_MODEL}' LIMIT ${BATCH_SIZE}`
    )
    if (rows.length === 0) break

    // Process CONCURRENCY rows at a time within the batch
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const chunk = rows.slice(i, i + CONCURRENCY)
      const results = await Promise.all(
        chunk.map(row => processRow(table, textCol, row))
      )
      done += results.filter(Boolean).length
      errors += results.filter(r => !r).length
      process.stdout.write(`\r  ${done}/${total} (${errors} erros)`)
    }
  }

  console.log(`\n  ✅ ${table} concluído: ${done} atualizados, ${errors} erros`)
}

console.log(`🚀 Re-embedding direto com modelo: ${EMBEDDING_MODEL}`)
console.log(`   Concorrência: ${CONCURRENCY} | Batch: ${BATCH_SIZE}`)

try {
  await processTable('cat_itens', 'descricao')
  await processTable('cats', 'descricao_tecnica')
  await processTable('req_parcelas_relevancia', 'servico')
} finally {
  await sql.end()
}

console.log('\n🎉 Re-embedding concluído!')
