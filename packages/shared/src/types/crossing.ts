export type CrossingStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'error'

export type Recomendacao =
  | 'participar'
  | 'participar_com_ressalvas'
  | 'nao_participar'

export type CrossingItemResultado =
  | 'atendido'
  | 'atendido_parcialmente'
  | 'gap'

export type NivelMatch = 'cat' | 'item'

export type AvaliacaoLlm = 'atende' | 'atende_parcialmente' | 'nao_atende'

export interface Crossing {
  id: string
  tenantId: string
  editalId: string
  triggeredBy: string
  status: CrossingStatus
  scoreAderencia: number | null
  totalRequisitos: number | null
  requisitosAtendidos: number | null
  requisitosComRessalva: number | null
  requisitosGap: number | null
  recomendacao: Recomendacao | null
  recomendacaoJustificativa: string | null
  aiCostUsd: number | null
  processingTimeSeconds: number | null
  createdAt: Date
  updatedAt: Date
}

export interface CrossingItem {
  id: string
  tenantId: string
  crossingId: string
  requisitoId: string
  resultado: CrossingItemResultado
  aiJustificativa: string | null
  scoreSimilaridadeMax: number | null
  humanOverride: boolean
  humanOverrideBy: string | null
  humanOverrideNote: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CrossingItemCat {
  id: string
  crossingItemId: string
  catId: string
  catItemId: string | null
  nivelMatch: NivelMatch
  scoreSimilaridade: number
  avaliacaoLlm: AvaliacaoLlm
  justificativaLlm: string
  rankPosicao: number
  createdAt: Date
}
