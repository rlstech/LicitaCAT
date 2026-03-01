const VOYAGE_API_KEY = process.env['VOYAGE_API_KEY']
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const EMBEDDING_MODEL = 'voyage-large-2'
const EMBEDDING_DIMENSIONS = 1536

// Pricing: $0.12 per million tokens
const COST_PER_MILLION_TOKENS = 0.12

export interface EmbeddingResult {
  embedding: number[]
  tokensUsed: number
  costUsd: number
}

export interface BatchEmbeddingResult {
  embeddings: number[][]
  tokensUsed: number
  costUsd: number
}

async function callVoyageApi(
  input: string | string[],
  inputType: 'document' | 'query',
): Promise<{ data: Array<{ embedding: number[] }>; usage: { total_tokens: number } }> {
  if (!VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY environment variable is required')
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
      input_type: inputType,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voyage AI API error: ${response.status} ${error}`)
  }

  return response.json() as Promise<{
    data: Array<{ embedding: number[] }>
    usage: { total_tokens: number }
  }>
}

export async function generateEmbedding(
  text: string,
  inputType: 'document' | 'query' = 'document',
): Promise<EmbeddingResult> {
  const result = await callVoyageApi(text, inputType)
  const embedding = result.data[0]?.embedding

  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}`)
  }

  const tokensUsed = result.usage.total_tokens
  const costUsd = (tokensUsed / 1_000_000) * COST_PER_MILLION_TOKENS

  return { embedding, tokensUsed, costUsd }
}

export async function generateBatchEmbeddings(
  texts: string[],
  inputType: 'document' | 'query' = 'document',
): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    return { embeddings: [], tokensUsed: 0, costUsd: 0 }
  }

  // Voyage AI supports up to 128 inputs per request
  const BATCH_SIZE = 128
  const allEmbeddings: number[][] = []
  let totalTokens = 0

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const result = await callVoyageApi(batch, inputType)

    for (const item of result.data) {
      allEmbeddings.push(item.embedding)
    }
    totalTokens += result.usage.total_tokens
  }

  const costUsd = (totalTokens / 1_000_000) * COST_PER_MILLION_TOKENS

  return { embeddings: allEmbeddings, tokensUsed: totalTokens, costUsd }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += (a[i] ?? 0) * (b[i] ?? 0)
    normA += (a[i] ?? 0) ** 2
    normB += (b[i] ?? 0) ** 2
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
