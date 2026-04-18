export interface Crossing {
  id: string
  editalId: string
  status: string
  scoreAderencia: number | null
  totalRequisitos: number | null
  requisitosAtendidos: number | null
  requisitosComRessalva: number | null
  requisitosGap: number | null
  recomendacao: string | null
  recomendacaoJustificativa: string | null
  aiCostUsd: string | null
  processingTimeSeconds: number | null
  createdAt: string
  pendingCount: number
}

export interface CatMatch {
  crossingItemId: string
  catId: string
  catItemId: string | null
  nivelMatch: string
  scoreSimilaridade: string
  avaliacaoLlm: string
  justificativaLlm: string
  rankPosicao: number
  catEmpresaContratante: string | null
  catTipoObra: string | null
  catNumeroCat: string | null
  catDescricaoTecnica: string | null
  catItemDescricao: string | null
  catItemQuantidade: string | null
  catItemUnidade: string | null
}

export interface CrossingItem {
  id: string
  resultado: string
  aiJustificativa: string | null
  scoreSimilaridadeMax: string | null
  humanOverride: boolean
  humanOverrideNote: string | null
  parcelaServico: string
  parcelaUnidade: string | null
  parcelaQuantidadeMinima: string | null
  parcelaQuantidadeAcervo: number | null
  parcelaCoberturaPct: number | null
  justUpdated?: boolean
  catMatches: CatMatch[]
}

export interface OverrideModal {
  itemId: string
  action: 'aprovar' | 'rejeitar'
  itemLabel: string
  note: string
}

export type ActiveTab = 'todos' | 'pendentes' | 'atendidos' | 'gaps'

export interface RecConfig {
  label: string
  description: string
  accentColor: string
  badgeBg: string
  badgeText: string
  icon: string
}

export interface Counts {
  atendidos: number
  parciais: number
  gaps: number
  total: number
  pendentes: number
  revisados: number
  totalParciais: number
}
