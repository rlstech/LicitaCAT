import { getAiProvider, getGenAI } from '../provider.js'

/**
 * Embedding model id.
 *
 * The model name differs between backends: AI Studio exposes
 * `gemini-embedding-2-preview`; Vertex AI exposes `gemini-embedding-001`
 * (both support 768 dims via outputDimensionality). Configurable via env.
 *
 * NOTE: changing this value marks previously-stored embeddings as belonging to
 * a different model — search queries filter by `embedding_model =
 * CURRENT_EMBEDDING_MODEL`, so a re-embedding pass (reembed_batch) is required
 * after switching backends.
 */
export const CURRENT_EMBEDDING_MODEL =
  process.env['EMBEDDING_MODEL'] ||
  (getAiProvider() === 'vertex' ? 'gemini-embedding-001' : 'gemini-embedding-2-preview')

const EMBEDDING_MODEL = CURRENT_EMBEDDING_MODEL
const EMBEDDING_DIMENSIONS = 768

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

  const ai = getGenAI()
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  })

  const embedding = response.embeddings?.[0]?.values

  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding?.length}`,
    )
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
