import { Worker, type Job } from 'bullmq'
import { z } from 'zod'
import { db } from '@licitacat/db'
import { pncpCache } from '@licitacat/db/schema'
import { callLlm } from '@licitacat/ai/llm'
import {
  PNCP_CLASSIFICATION_SYSTEM_PROMPT,
  buildPncpClassificationUserPrompt,
} from '@licitacat/ai/prompts'
import {
  SEGMENTOS,
  classificarPorKeywords,
  type ClassificacaoResult,
} from '@licitacat/shared/pncp-segments'
import { eq, isNull, desc } from 'drizzle-orm'
import type { PncpClassifyJobData } from '../queues/index.js'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

const DELAY_BETWEEN_LLM_CALLS_MS = 500
const DEFAULT_BATCH_SIZE = 100

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const llmResponseSchema = z.object({
  segmentos: z.array(z.string()),
  confianca: z.enum(['alta', 'media', 'baixa']),
  justificativa: z.string(),
})

async function classificarPorIA(
  objeto: string,
  razaoSocial?: string | null,
  valor?: string | null,
): Promise<ClassificacaoResult> {
  const valorNum = valor ? parseFloat(valor) : undefined

  const response = await callLlm({
    system: PNCP_CLASSIFICATION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: buildPncpClassificationUserPrompt(
        objeto,
        undefined,
        razaoSocial ?? undefined,
        valorNum,
      ),
    }],
    max_tokens: 600,
  })

  let raw = response.text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()

  // Extrai apenas o bloco JSON caso haja texto extra ao redor
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) raw = jsonMatch[0]

  // Remove vírgulas finais desnecessárias
  const normalized = raw
    .replace(/,\s*([}\]])/g, '$1')

  let parsed: unknown
  try {
    parsed = JSON.parse(normalized)
  } catch {
    // Última tentativa: extrair campos via regex
    const segsMatch = normalized.match(/"segmentos"\s*:\s*\[(.*?)\]/s)
    const confMatch = normalized.match(/"confianca"\s*:\s*"([^"]+)"/)
    const justMatch = normalized.match(/"justificativa"\s*:\s*"([^"]+)"/)
    parsed = {
      segmentos: segsMatch ? segsMatch[1].split(',').map((s: string) => s.replace(/"/g, '').trim()).filter(Boolean) : [],
      confianca: confMatch?.[1] ?? 'baixa',
      justificativa: justMatch?.[1] ?? '',
    }
  }

  const dados = llmResponseSchema.parse(parsed)
  const segmentosValidos = dados.segmentos.filter(s =>
    (SEGMENTOS as readonly string[]).includes(s),
  )

  return {
    segmentos: segmentosValidos,
    confianca: dados.confianca,
    metodo: 'ia',
    justificativa: dados.justificativa,
    keywordsEncontradas: [],
  }
}

async function processPncpClassify(job: Job<PncpClassifyJobData>): Promise<void> {
  const batchSize = job.data.batchSize ?? DEFAULT_BATCH_SIZE

  const pending = await db.select({
    id: pncpCache.id,
    objeto: pncpCache.objeto,
    razaoSocial: pncpCache.razaoSocial,
    valorTotalEstimado: pncpCache.valorTotalEstimado,
  })
    .from(pncpCache)
    .where(isNull(pncpCache.classificadoAt))
    .orderBy(desc(pncpCache.dataAberturaProposta))
    .limit(batchSize)

  if (pending.length === 0) {
    console.log('[pncp-classify] Nenhum registro pendente de classificação.')
    return
  }

  console.log(`[pncp-classify] Classificando ${pending.length} registros...`)
  let kwCount = 0
  let iaCount = 0
  let semMatchCount = 0
  let failCount = 0

  for (const record of pending) {
    try {
      let resultado: ClassificacaoResult

      if (!record.objeto) {
        resultado = {
          segmentos: [],
          confianca: 'baixa',
          metodo: 'sem_match',
          justificativa: 'Objeto vazio.',
          keywordsEncontradas: [],
        }
      } else {
        resultado = classificarPorKeywords(record.objeto)

        if (resultado.metodo === 'sem_match') {
          try {
            resultado = await classificarPorIA(
              record.objeto,
              record.razaoSocial,
              record.valorTotalEstimado,
            )
            await sleep(DELAY_BETWEEN_LLM_CALLS_MS)
          } catch (err) {
            console.warn(
              `[pncp-classify] Erro IA para ${record.id}:`,
              err instanceof Error ? err.message : err,
            )
            resultado = {
              segmentos: [],
              confianca: 'baixa',
              metodo: 'sem_match',
              justificativa: `Erro na classificação IA: ${err instanceof Error ? err.message : String(err)}`,
              keywordsEncontradas: [],
            }
          }
        }
      }

      await db.update(pncpCache)
        .set({
          segmentos: resultado.segmentos,
          classificacaoConfianca: resultado.confianca,
          classificacaoMetodo: resultado.metodo,
          classificacaoJustificativa: resultado.justificativa,
          classificacaoKeywords: resultado.keywordsEncontradas,
          classificadoAt: new Date(),
        })
        .where(eq(pncpCache.id, record.id))

      if (resultado.metodo === 'keyword') kwCount++
      else if (resultado.metodo === 'ia') iaCount++
      else semMatchCount++
    } catch (err) {
      console.error(
        `[pncp-classify] Erro ao classificar ${record.id}:`,
        err instanceof Error ? err.message : err,
      )
      failCount++
    }

    await job.updateProgress(Math.round(((kwCount + iaCount + semMatchCount + failCount) / pending.length) * 100))
  }

  console.log(
    `[pncp-classify] Concluído: ${kwCount} keyword, ${iaCount} IA, ${semMatchCount} sem match, ${failCount} falhas.`,
  )
}

export function createPncpClassifyWorker(): Worker<PncpClassifyJobData> {
  return new Worker<PncpClassifyJobData>('pncp_classify', processPncpClassify, {
    connection,
    concurrency: 1,
    lockDuration: 600000,
    lockRenewTime: 240000,
  })
}
