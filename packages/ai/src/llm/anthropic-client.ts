/**
 * PDF extraction using Gemini (Google Generative AI).
 * Uses the existing callLlm client with inline PDF support.
 */
import { callLlm, calculateCostUsd, DEFAULT_MODEL } from './client.js'

const MAX_PDF_SIZE_BYTES = 32 * 1024 * 1024 // 32MB

export interface AnthropicUsage {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface ExtractEditalResult {
  json: unknown
  inputTokens: number
  outputTokens: number
  costUsd: number
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}

export async function extractEditalFromPdf(
  pdfBuffer: Buffer,
  systemPrompt: string,
  userPrompt: string,
): Promise<ExtractEditalResult> {
  if (pdfBuffer.length > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      `PDF too large: ${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB exceeds 32MB limit`,
    )
  }

  const response = await callLlm({
    max_tokens: 16000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
        inlineFiles: [{ data: pdfBuffer, mimeType: 'application/pdf' }],
      },
    ],
  })

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const costUsd = calculateCostUsd(DEFAULT_MODEL, inputTokens, outputTokens)

  const cleaned = stripMarkdownFences(response.text)
  const json: unknown = JSON.parse(cleaned)

  return { json, inputTokens, outputTokens, costUsd }
}
