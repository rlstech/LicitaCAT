import Anthropic from '@anthropic-ai/sdk'

const apiKey = process.env['ANTHROPIC_API_KEY']

if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required')
}

export const anthropic = new Anthropic({ apiKey })

export const DEFAULT_MODEL = 'claude-sonnet-4-6' as const

// Pricing per million tokens (USD) — update as pricing changes
const PRICING = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
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
