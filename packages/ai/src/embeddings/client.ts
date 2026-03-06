import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env['GEMINI_API_KEY']
if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required')
}

const genAI = new GoogleGenerativeAI(apiKey)
const EMBEDDING_MODEL = 'text-embedding-004'
const EMBEDDING_DIMENSIONS = 768

// Gemini embedding pricing: ~$0.00 (free tier) or very low cost
const COST_PER_MILLION_TOKENS = 0.000

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
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
  const taskType = inputType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT'

  const result = await model.embedContent({
    content: { parts: [{ text }], role: 'user' },
    taskType: taskType as Parameters<typeof model.embedContent>[0]['taskType'],
  })

  const embedding = result.embedding.values
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

  return { embeddings, tokensUsed: 0, costUsd: COST_PER_MILLION_TOKENS }
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
