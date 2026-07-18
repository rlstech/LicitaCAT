import type { Content, GenerateContentResponse } from '@google/genai'
import { getAiProvider, getGenAI } from '../provider.js'

/**
 * LLM model id. Configurable via env so the Vertex model name (which may differ
 * from the AI Studio name) can be set without a code change.
 * Falls back to the AI Studio name for the `studio` provider.
 */
export const DEFAULT_MODEL = process.env['LLM_MODEL'] || 'gemini-2.5-flash'

// Pricing per million tokens (USD). Unknown models fall back to DEFAULT_PRICING.
const DEFAULT_PRICING = { input: 0.5, output: 3.0 }
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-3-flash-preview': { input: 0.5, output: 3.0 },
}

export function calculateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PRICING[model] ?? DEFAULT_PRICING
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

/**
 * Gemini 2.5 flash models are "thinking" models: reasoning tokens are billed
 * against `maxOutputTokens`, so a large structured response (e.g. edital JSON)
 * can be truncated mid-string before the real output completes. For structured
 * extraction we disable thinking (`thinkingBudget: 0`) so the whole budget is
 * available for the answer. Only flash/flash-lite support a zero budget — pro
 * models enforce a minimum, so we skip them and leave thinking on by default.
 */
function thinkingConfigFor(model: string): { thinkingConfig?: { thinkingBudget: number } } {
  return /2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}
}

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface LlmResponse {
  text: string
  /** 'STOP' = normal, 'MAX_TOKENS' = response was cut at the token limit */
  finishReason: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface LlmInlineFile {
  data: Buffer
  mimeType: string
}

function toContents(
  messages: Array<{ role: 'user' | 'assistant'; content: string; inlineFiles?: LlmInlineFile[] }>,
): Content[] {
  return messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [
      ...(m.inlineFiles ?? []).map((f) => ({
        inlineData: { data: f.data.toString('base64'), mimeType: f.mimeType },
      })),
      { text: m.content },
    ],
  }))
}

function toLlmResponse(response: GenerateContentResponse): LlmResponse {
  const candidate = response.candidates?.[0]
  const finishReason = candidate?.finishReason ?? 'STOP'
  return {
    text: response.text ?? '',
    finishReason: String(finishReason),
    usage: {
      input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    },
  }
}

/**
 * Create a Gemini context cache with the given system instruction.
 * Returns the cache name (used to retrieve it later).
 *
 * NOTE: Gemini/Vertex require a minimum number of tokens in cached content.
 * For small system prompts, cache creation may fail. Always use try/catch and
 * fall back to normal callLlm on failure.
 *
 * @param systemInstruction - The system prompt to cache
 * @param ttlSeconds - Cache lifetime in seconds (default: 600 = 10 minutes)
 */
export async function createLlmCache(options: {
  systemInstruction: string
  ttlSeconds?: number
}): Promise<string> {
  const ai = getGenAI()
  const cached = await ai.caches.create({
    model: DEFAULT_MODEL,
    config: {
      systemInstruction: options.systemInstruction,
      ttl: `${options.ttlSeconds ?? 600}s`,
    },
  })
  if (!cached.name) throw new Error('Gemini cache created without a name')
  return cached.name
}

/**
 * Call Gemini using a previously created context cache.
 */
export async function callLlmWithCache(options: {
  cacheName: string
  max_tokens?: number
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<LlmResponse> {
  const ai = getGenAI()
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: toContents(options.messages),
    config: {
      cachedContent: options.cacheName,
      maxOutputTokens: options.max_tokens ?? 4096,
      ...thinkingConfigFor(DEFAULT_MODEL),
    },
  })
  return toLlmResponse(response)
}

export async function* streamLlm(options: {
  model?: string
  max_tokens?: number
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}): AsyncGenerator<string> {
  const ai = getGenAI()
  const stream = await ai.models.generateContentStream({
    model: options.model ?? DEFAULT_MODEL,
    contents: toContents(options.messages),
    config: {
      maxOutputTokens: options.max_tokens ?? 2048,
      ...(options.system ? { systemInstruction: options.system } : {}),
      ...thinkingConfigFor(options.model ?? DEFAULT_MODEL),
    },
  })

  for await (const chunk of stream) {
    const text = chunk.text
    if (text) yield text
  }
}

export async function callLlm(options: {
  model?: string
  max_tokens?: number
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string; inlineFiles?: LlmInlineFile[] }>
}): Promise<LlmResponse> {
  const ai = getGenAI()
  const response = await ai.models.generateContent({
    model: options.model ?? DEFAULT_MODEL,
    contents: toContents(options.messages),
    config: {
      maxOutputTokens: options.max_tokens ?? 4096,
      ...(options.system ? { systemInstruction: options.system } : {}),
      ...thinkingConfigFor(options.model ?? DEFAULT_MODEL),
    },
  })
  return toLlmResponse(response)
}

// Re-exported so callers can log which backend is active.
export { getAiProvider } from '../provider.js'
