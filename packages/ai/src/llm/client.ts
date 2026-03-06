import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env['GEMINI_API_KEY']

if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is required')
}

const genAI = new GoogleGenerativeAI(apiKey)

export const DEFAULT_MODEL = 'gemini-2.0-flash' as const

// Pricing per million tokens (USD)
const PRICING = {
  'gemini-2.0-flash': { input: 0.075, output: 0.30 },
} as const

export function calculateCostUsd(
  model: keyof typeof PRICING,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PRICING[model]
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface LlmResponse {
  text: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface LlmInlineFile {
  data: Buffer
  mimeType: string
}

export async function callLlm(options: {
  model?: string
  max_tokens?: number
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string; inlineFiles?: LlmInlineFile[] }>
}): Promise<LlmResponse> {
  const modelName = options.model ?? DEFAULT_MODEL

  const model = genAI.getGenerativeModel({
    model: modelName,
    ...(options.system ? { systemInstruction: options.system } : {}),
  })

  const result = await model.generateContent({
    contents: options.messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [
        ...(m.inlineFiles ?? []).map((f) => ({
          inlineData: { data: f.data.toString('base64'), mimeType: f.mimeType },
        })),
        { text: m.content },
      ],
    })),
    generationConfig: {
      maxOutputTokens: options.max_tokens ?? 4096,
    },
  })

  return {
    text: result.response.text(),
    usage: {
      input_tokens: result.response.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
    },
  }
}
