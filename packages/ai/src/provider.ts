import { GoogleGenAI } from '@google/genai'

/**
 * AI backend selection.
 *
 * - `vertex`  → Google Vertex AI (aiplatform.googleapis.com), billed through the
 *   Google Cloud project so it can consume Cloud credits. Auth via ADC
 *   (GOOGLE_APPLICATION_CREDENTIALS). Requires GOOGLE_VERTEX_PROJECT.
 * - `studio`  → Gemini Developer API (AI Studio, generativelanguage.googleapis.com),
 *   billed through the separate Gemini prepay balance. Auth via GEMINI_API_KEY.
 *
 * Default is `vertex`. Flip to `studio` for an instant rollback (no rebuild).
 */
export type AiProvider = 'vertex' | 'studio'

export function getAiProvider(): AiProvider {
  const p = (process.env['AI_PROVIDER'] || 'vertex').toLowerCase()
  return p === 'studio' ? 'studio' : 'vertex'
}

let cachedClient: GoogleGenAI | null = null

/** Lazily-constructed, shared GoogleGenAI client for the active provider. */
export function getGenAI(): GoogleGenAI {
  if (cachedClient) return cachedClient

  if (getAiProvider() === 'studio') {
    const apiKey = process.env['GEMINI_API_KEY']
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required when AI_PROVIDER=studio')
    }
    cachedClient = new GoogleGenAI({ apiKey })
  } else {
    const project = process.env['GOOGLE_VERTEX_PROJECT']
    const location = process.env['GOOGLE_VERTEX_LOCATION'] || 'us-central1'
    if (!project) {
      throw new Error('GOOGLE_VERTEX_PROJECT environment variable is required when AI_PROVIDER=vertex')
    }
    cachedClient = new GoogleGenAI({ vertexai: true, project, location })
  }

  return cachedClient
}
