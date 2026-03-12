const apiKey = process.env['GEMINI_API_KEY']
if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required')
}

const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`

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

export async function generateEmbedding(
  text: string,
  inputType: 'document' | 'query' = 'document',
): Promise<EmbeddingResult> {
  const taskType = inputType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT'

  const response = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini embedding API error ${response.status}: ${errorText}`)
  }

  const data = await response.json() as { embedding: { values: number[] } }
  const embedding = data.embedding.values

  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding?.length}`)
  }

  return { embedding, tokensUsed: 0, costUsd: 0 }
}

export async function generateBatchEmbeddings(
  texts: string[],
  inputType: 'document' | 'query' = 'document',
): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    return { embeddings: [], tokensUsed: 0, costUsd: 0 }
  }

  const embeddings: number[][] = []
  for (const text of texts) {
    const result = await generateEmbedding(text, inputType)
    embeddings.push(result.embedding)
  }

  return { embeddings, tokensUsed: 0, costUsd: 0 }
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
