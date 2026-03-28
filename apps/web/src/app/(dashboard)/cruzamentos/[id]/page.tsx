'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import Link from 'next/link'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Crossing {
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

interface CatMatch {
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

interface CrossingItem {
  id: string
  resultado: string
  aiJustificativa: string | null
  scoreSimilaridadeMax: string | null
  humanOverride: boolean
  humanOverrideNote: string | null
  parcelaServico: string
  parcelaUnidade: string | null
  parcelaQuantidadeMinima: string | null
  catMatches: CatMatch[]
}

interface OverrideModal {
  itemId: string
  action: 'aprovar' | 'rejeitar'
  itemLabel: string
  note: string
}

type ActiveTab = 'todos' | 'pendentes' | 'atendidos' | 'gaps'

// ── Config ────────────────────────────────────────────────────────────────────

const REC_CONFIG: Record<string, {
  label: string
  description: string
  accentColor: string
  badgeBg: string
  badgeText: string
  icon: string
}> = {
  participar: {
    label: 'Participar',
    description: 'Os requisitos técnicos estão cobertos pelo acervo.',
    accentColor: '#10b981',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    icon: 'check_circle',
  },
  participar_com_ressalvas: {
    label: 'Participar com Ressalvas',
    description: 'Há lacunas que devem ser avaliadas antes de participar.',
    accentColor: '#f59e0b',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    icon: 'warning',
  },
  nao_participar: {
    label: 'Não Participar',
    description: 'O acervo não atende os requisitos técnicos exigidos.',
    accentColor: '#dc2626',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    icon: 'cancel',
  },
}

// ── Score Arc ─────────────────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const r = 40
  const circumference = 2 * Math.PI * r   // ≈ 251.3
  const arcLength = circumference * 0.75  // 270° track ≈ 188.5
  const progressLength = arcLength * (score / 100)
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#dc2626'

  return (
    <div className="relative flex h-48 w-48 items-center justify-center">
      <svg
        className="h-full w-full"
        style={{ transform: 'rotate(-225deg)', transformOrigin: 'center' }}
        viewBox="0 0 100 100"
      >
        {/* Track */}
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          stroke="#e6f6ff"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        {/* Progress */}
        {score > 0 && (
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${circumference}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <span className="text-4xl font-extrabold text-[#003746]">{score}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Score IA</span>
      </div>
    </div>
  )
}

// ── CAT Matches Card ──────────────────────────────────────────────────────────

function CatMatchesCard({ item }: { item: CrossingItem }) {
  const [open, setOpen] = useState(false)
  const matching = item.catMatches.filter(m => m.avaliacaoLlm !== 'nao_atende')

  if (item.catMatches.length === 0) return null

  return (
    <div className="mt-4 rounded-lg bg-[#e6f6ff]" style={{ border: '1px solid rgba(0,55,70,0.08)' }}>
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="material-symbols-outlined text-[18px] text-[#003746]">link</span>
        <h5 className="flex-1 text-[10px] font-bold uppercase tracking-wider text-[#003746]">
          Acervo Vinculado ({matching.length} CAT{matching.length !== 1 ? 's' : ''} encontrada{matching.length !== 1 ? 's' : ''})
        </h5>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs font-semibold text-[#003746] transition-colors hover:underline"
        >
          {open ? 'Ocultar' : 'Ver detalhes'}
        </button>
      </div>

      {open && matching.length > 0 && (
        <div className="space-y-3 px-4 pb-4">
          {matching.map((match, idx) => {
            const similarity = (parseFloat(match.scoreSimilaridade) * 100).toFixed(0)
            const qty = match.catItemQuantidade
              ? parseFloat(match.catItemQuantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
              : null

            return (
              <div key={idx} className="rounded-lg bg-white p-4" style={{ border: '1px solid rgba(0,55,70,0.06)' }}>
                <div className="flex flex-col gap-3 md:flex-row md:gap-6">
                  <div className="flex-1 space-y-2 md:border-r md:border-slate-200/60 md:pr-6">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Empresa</p>
                      <p className="text-xs font-semibold text-[#003746]">
                        {match.catEmpresaContratante ?? match.catTipoObra ?? '—'}
                      </p>
                    </div>
                    {match.catNumeroCat && (
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Número da CAT</p>
                        <p className="text-xs font-semibold text-[#003746]">{match.catNumeroCat}</p>
                      </div>
                    )}
                    {qty && (
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Quantitativo</p>
                        <p className="text-xs font-semibold text-emerald-600">
                          {qty} {match.catItemUnidade ?? ''}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Similaridade</p>
                      <p className="text-xs font-semibold text-[#003746]">{similarity}%</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Nível</p>
                      <p className="text-xs capitalize text-slate-500">{match.nivelMatch}</p>
                    </div>
                  </div>
                  <div className="flex-[1.5]">
                    <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-400">Justificativa do LLM</p>
                    {(match.catItemDescricao ?? match.catDescricaoTecnica) && (
                      <p className="mb-1.5 text-xs font-medium text-slate-700">
                        {match.catItemDescricao ?? match.catDescricaoTecnica}
                      </p>
                    )}
                    {match.justificativaLlm && (
                      <p className="text-xs italic leading-relaxed text-slate-500">
                        &ldquo;{match.justificativaLlm}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {matching.length === 0 && (
            <p className="pb-2 text-xs text-slate-400">Nenhuma CAT atende este requisito.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CruzamentoDetailPage() {
  const { getToken } = useAuth()
  const params = useParams()
  const crossingId = params.id as string

  const [crossing, setCrossing] = useState<Crossing | null>(null)
  const [items, setItems] = useState<CrossingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('todos')
  const [overrideModal, setOverrideModal] = useState<OverrideModal | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const token = await getToken()
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      const [cRes, iRes] = await Promise.all([
        fetch(`${API_URL}/api/crossings/${crossingId}`, { headers }),
        fetch(`${API_URL}/api/crossings/${crossingId}/items`, { headers }),
      ])
      if (cRes.ok) {
        const data = await cRes.json() as Crossing
        setCrossing(data)
      }
      if (iRes.ok) setItems(await iRes.json() as CrossingItem[])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getToken, crossingId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => {
      if (crossing?.status === 'processing') fetchData()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchData, crossing?.status])

  async function startNewCrossing() {
    if (!crossing) return
    setRetrying(true)
    try {
      const token = await getToken()
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      const res = await fetch(`${API_URL}/api/crossings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ editalId: crossing.editalId }),
      })
      if (res.ok) {
        const { crossingId: newId } = await res.json() as { crossingId: string }
        window.location.href = `/cruzamentos/${newId}`
      }
    } catch { /* silent */ } finally { setRetrying(false) }
  }

  async function exportCSV() {
    setExporting(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/crossings/${crossingId}/export/csv`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) {
        const blob = await res.blob()
        downloadBlob(blob, `cruzamento-${crossingId.slice(0, 8)}.csv`)
      }
    } catch { /* silent */ } finally { setExporting(false) }
  }

  async function overrideItem(itemId: string, resultado: string, note?: string) {
    setSubmitting(itemId)
    try {
      const token = await getToken()
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      const res = await fetch(`${API_URL}/api/crossings/${crossingId}/items/${itemId}/override`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ resultado, note }),
      })
      if (!res.ok) return
      setItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, resultado, humanOverride: true, humanOverrideNote: note ?? null } : i
      ))
      const cRes = await fetch(`${API_URL}/api/crossings/${crossingId}`, { headers })
      if (cRes.ok) setCrossing(await cRes.json() as Crossing)
      setOverrideModal(null)
    } catch { /* silent */ } finally { setSubmitting(null) }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-3 py-32">
      <span className="material-symbols-outlined animate-spin text-[28px] text-[#003746]">sync</span>
      <p className="text-sm text-slate-400">Carregando análise…</p>
    </div>
  )

  if (!crossing) return (
    <div className="py-20 text-center">
      <p className="text-sm text-slate-400">Cruzamento não encontrado.</p>
      <Link href="/cruzamentos" className="mt-4 inline-block text-sm font-medium text-[#003746] hover:underline">← Voltar</Link>
    </div>
  )

  const recInfo = crossing.recomendacao ? REC_CONFIG[crossing.recomendacao] : null

  const atendidosCount = items.length > 0 ? items.filter(i => i.resultado === 'atendido').length : (crossing.requisitosAtendidos ?? 0)
  const parciaisCount  = items.length > 0 ? items.filter(i => i.resultado === 'atendido_parcialmente').length : (crossing.requisitosComRessalva ?? 0)
  const gapsCount      = items.length > 0 ? items.filter(i => i.resultado === 'gap').length : (crossing.requisitosGap ?? 0)
  const total          = items.length > 0 ? items.length : (crossing.totalRequisitos ?? 0)

  const pendentes      = items.filter(i => i.resultado === 'atendido_parcialmente' && !i.humanOverride)
  const totalParciais  = crossing.requisitosComRessalva ?? parciaisCount
  const revisados      = items.filter(i => i.humanOverride && (i.resultado === 'atendido' || i.resultado === 'gap')).length

  const barTotal = atendidosCount + parciaisCount + gapsCount
  const pAtend   = barTotal > 0 ? (atendidosCount / barTotal) * 100 : 0
  const pParc    = barTotal > 0 ? (parciaisCount  / barTotal) * 100 : 0
  const pGap     = barTotal > 0 ? (gapsCount      / barTotal) * 100 : 0

  const tabItems: Record<ActiveTab, CrossingItem[]> = {
    todos:     items,
    pendentes,
    atendidos: items.filter(i => i.resultado === 'atendido'),
    gaps:      items.filter(i => i.resultado === 'gap'),
  }
  const filteredItems = tabItems[activeTab]

  const tabs: { key: ActiveTab; label: string; count: number }[] = [
    { key: 'todos',     label: 'Todos os itens', count: items.length },
    { key: 'pendentes', label: 'Pendentes',      count: pendentes.length },
    { key: 'atendidos', label: 'Atendidos',      count: items.filter(i => i.resultado === 'atendido').length },
    { key: 'gaps',      label: 'Gaps',           count: items.filter(i => i.resultado === 'gap').length },
  ]

  return (
    <div className="pb-16">

      {/* ── Breadcrumb & Actions ── */}
      <div className="mb-8 flex items-start justify-between" data-print-hide>
        <div className="flex flex-col gap-1">
          <Link
            href="/cruzamentos"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#003746] hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Voltar para Cruzamentos
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-[#003746]">
            Análise de Cruzamento
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startNewCrossing}
            disabled={retrying || crossing.status === 'processing' || crossing.status === 'queued'}
            className="flex items-center gap-2 rounded-lg bg-[#e6f6ff] px-4 py-2 text-sm font-semibold text-[#003746] transition-colors hover:bg-[#d5ecf8] disabled:opacity-40"
          >
            <span className={`material-symbols-outlined text-[18px] ${retrying ? 'animate-spin' : ''}`}>refresh</span>
            {retrying ? 'Iniciando…' : 'Nova tentativa'}
          </button>

          {crossing.status === 'completed' && (
            <>
              <button
                onClick={exportCSV}
                disabled={exporting}
                className="flex items-center gap-2 rounded-lg bg-[#e6f6ff] px-4 py-2 text-sm font-semibold text-[#003746] transition-colors hover:bg-[#d5ecf8] disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                {exporting ? 'Exportando…' : 'Exportar CSV'}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg bg-[#003746] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Imprimir
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Processing banner ── */}
      {crossing.status === 'processing' && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#003746]/20 bg-[#003746]/5 px-5 py-3.5">
          <span className="material-symbols-outlined animate-spin text-[20px] text-[#003746]">sync</span>
          <p className="text-sm font-medium text-[#003746]">Cruzamento em andamento — atualizando a cada 5 segundos…</p>
        </div>
      )}

      {/* ── Error banner ── */}
      {crossing.status === 'error' && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-red-500">error</span>
            <p className="text-sm font-medium text-red-800">O cruzamento falhou. Verifique os logs ou tente novamente.</p>
          </div>
          <button
            onClick={startNewCrossing}
            disabled={retrying}
            className="shrink-0 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {retrying ? 'Iniciando…' : 'Tentar novamente'}
          </button>
        </div>
      )}

      {/* ── Hero Grid ── */}
      {recInfo && (
        <div className="mb-8 grid grid-cols-12 gap-6">

          {/* Score Card — col 8 */}
          <div
            className="col-span-12 overflow-hidden rounded-xl bg-white shadow-sm lg:col-span-8"
            style={{ borderTop: `4px solid ${recInfo.accentColor}` }}
          >
            <div className="flex flex-col items-center gap-8 p-6 md:flex-row">

              {/* Arc */}
              <div className="shrink-0">
                {crossing.scoreAderencia !== null && (
                  <ScoreArc score={crossing.scoreAderencia} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-4">
                {/* Badge */}
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${recInfo.badgeBg} ${recInfo.badgeText}`}>
                  <span
                    className="material-symbols-outlined text-[14px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {recInfo.icon}
                  </span>
                  Recomendação: {recInfo.label}
                </div>

                <h3 className="text-base font-bold text-[#003746]">Justificativa da Inteligência Artificial</h3>

                {crossing.recomendacaoJustificativa && (
                  <p className="max-w-lg text-sm italic leading-relaxed text-slate-600">
                    &ldquo;{crossing.recomendacaoJustificativa}&rdquo;
                  </p>
                )}

                {/* Stacked bar */}
                {barTotal > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between text-[11px] font-bold uppercase text-slate-400">
                      <span>Coerência de Requisitos</span>
                      <span>{total} Requisitos Totais</span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#e6f6ff]">
                      {pAtend > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pAtend}%` }} />}
                      {pParc  > 0 && <div className="h-full bg-amber-400 transition-all"   style={{ width: `${pParc}%`  }} />}
                      {pGap   > 0 && <div className="h-full bg-red-500 transition-all"     style={{ width: `${pGap}%`   }} />}
                    </div>
                    <div className="flex gap-5 pt-1 text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {atendidosCount} Atendidos
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-600">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        {parciaisCount} Parcial{parciaisCount !== 1 ? 'is' : ''}
                      </span>
                      <span className="flex items-center gap-1.5 text-red-600">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {gapsCount} Gap{gapsCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column — col 4 */}
          <div className="col-span-12 flex flex-col gap-5 lg:col-span-4">

            {/* Review card */}
            <div className="rounded-xl bg-white p-5 shadow-sm" style={{ border: '1px solid rgba(0,55,70,0.08)' }}>
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                  <span className="material-symbols-outlined">fact_check</span>
                </div>
                <div>
                  <h4 className="font-bold text-[#003746]">
                    {pendentes.length > 0 ? 'Aguardando Revisão' : 'Revisão Concluída'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {pendentes.length > 0
                      ? `${pendentes.length} requisito${pendentes.length !== 1 ? 's' : ''} necessita${pendentes.length === 1 ? '' : 'm'} de validação humana.`
                      : 'Todos os requisitos foram revisados.'}
                  </p>
                </div>
              </div>
              {totalParciais > 0 && (
                <>
                  <div className="mb-1.5 flex justify-between text-[11px] font-medium text-slate-400">
                    <span>Progresso de revisão</span>
                    <span>{revisados}/{totalParciais}</span>
                  </div>
                  <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[#e6f6ff]">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${totalParciais > 0 ? (revisados / totalParciais) * 100 : 0}%` }}
                    />
                  </div>
                </>
              )}
              {pendentes.length > 0 && (
                <button
                  onClick={() => setActiveTab('pendentes')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-50 py-2 text-sm font-bold text-amber-600 transition-colors hover:bg-amber-100"
                >
                  Revisar Agora
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              )}
            </div>

            {/* Meta card */}
            {crossing.status === 'completed' && (crossing.processingTimeSeconds ?? crossing.aiCostUsd) && (
              <div className="rounded-xl bg-[#003746] p-5 shadow-sm">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#94cfe7]">Dados do Processamento</p>
                <div className="space-y-2">
                  {crossing.processingTimeSeconds && (
                    <div className="flex items-center gap-2 text-xs text-white/70">
                      <span className="material-symbols-outlined text-[16px]">timer</span>
                      Tempo: <span className="font-semibold text-white">{crossing.processingTimeSeconds}s</span>
                    </div>
                  )}
                  {crossing.aiCostUsd && (
                    <div className="flex items-center gap-2 text-xs text-white/70">
                      <span className="material-symbols-outlined text-[16px]">token</span>
                      Custo IA: <span className="font-mono font-semibold text-white">${crossing.aiCostUsd} USD</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      {items.length > 0 && (
        <div
          className="mb-6 flex items-center gap-6"
          style={{ borderBottom: '1px solid var(--border-soft)' }}
          data-print-hide
        >
          {tabs.map(({ key, label, count: cnt }) => {
            const isActive = activeTab === key
            const badgeClass =
              key === 'pendentes' && cnt > 0 ? 'bg-amber-100 text-amber-700' :
              key === 'atendidos'             ? 'bg-emerald-50 text-emerald-700' :
              key === 'gaps'                  ? 'bg-red-50 text-red-600' :
              isActive ? 'bg-[#e6f6ff] text-[#003746]' : 'bg-slate-100 text-slate-400'
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative flex items-center gap-2 pb-3 text-sm font-semibold transition-colors ${
                  isActive ? 'text-[#003746]' : 'text-slate-400 hover:text-slate-600'
                }`}
                style={isActive ? { boxShadow: 'inset 0 -2px 0 #003746' } : undefined}
              >
                {label}
                {cnt > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${badgeClass}`}>
                    {cnt}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Items List ── */}
      <div data-print-hide>
        {filteredItems.length === 0 && crossing.status !== 'processing' ? (
          <div className="rounded-xl bg-white p-10 text-center" style={{ border: '1px solid var(--border)' }}>
            {activeTab === 'pendentes' ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                  <span className="material-symbols-outlined text-[22px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <p className="text-sm font-semibold text-slate-700">Todos os itens foram revisados</p>
                <p className="text-xs text-slate-400">Nenhum requisito aguarda aprovação.</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                {items.length === 0 ? 'Nenhum requisito analisado.' : 'Nenhum item nesta categoria.'}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'gaps' && filteredItems.length > 0 && (
              <div className="my-2 flex items-center gap-4">
                <hr className="flex-1 border-red-100" />
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-red-500">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  Análise Crítica de GAPs
                </span>
                <hr className="flex-1 border-red-100" />
              </div>
            )}
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                submitting={submitting}
                onOverride={(itemId, action, label) =>
                  setOverrideModal({ itemId, action, itemLabel: label, note: '' })
                }
                onExceptionalOverride={(itemId, resultado) => overrideItem(itemId, resultado)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Print version ── */}
      <div className="print-only hidden space-y-3">
        {(['atendido', 'atendido_parcialmente', 'gap'] as const).map((grupo) => {
          const grupoItems = items.filter(i => i.resultado === grupo)
          if (grupoItems.length === 0) return null
          const grupoLabel = grupo === 'atendido' ? 'Atendidos' : grupo === 'atendido_parcialmente' ? 'Parciais' : 'Gaps'
          const grupoColor = grupo === 'atendido' ? '#10b981' : grupo === 'atendido_parcialmente' ? '#f59e0b' : '#dc2626'
          return (
            <div key={grupo}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: grupoColor }}>
                {grupoLabel} ({grupoItems.length})
              </p>
              {grupoItems.map((item, idx) => (
                <div key={item.id} className="mb-1.5 rounded-lg p-3 text-xs" style={{ border: `1px solid ${grupoColor}30`, borderLeft: `3px solid ${grupoColor}` }}>
                  <span className="font-semibold text-slate-900">{idx + 1}. {item.parcelaServico}</span>
                  {item.parcelaQuantidadeMinima && (
                    <span className="ml-2 text-slate-500">— {item.parcelaQuantidadeMinima} {item.parcelaUnidade ?? ''}</span>
                  )}
                  {item.aiJustificativa && <p className="mt-1 italic text-slate-500">{item.aiJustificativa}</p>}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* ── Modal de Override ── */}
      {overrideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white"
            style={{ boxShadow: '0 25px 50px rgba(15,23,42,0.20), 0 0 0 1px rgba(15,23,42,0.10)' }}
          >
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <h3 className="text-sm font-semibold text-slate-900">
                {overrideModal.action === 'aprovar' ? 'Aprovar como Atendido' : 'Rejeitar como Gap'}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{overrideModal.itemLabel}</p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-xs font-medium text-slate-600">
                Nota de revisão <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <textarea
                value={overrideModal.note}
                onChange={(e) => setOverrideModal(prev => prev ? { ...prev, note: e.target.value } : prev)}
                placeholder="Justifique a decisão…"
                rows={3}
                className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
              />
            </div>
            <div
              className="flex items-center justify-end gap-2 px-6 py-3"
              style={{ borderTop: '1px solid var(--border-soft)', backgroundColor: 'var(--canvas)' }}
            >
              <button
                onClick={() => setOverrideModal(null)}
                disabled={submitting === overrideModal.itemId}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white disabled:opacity-50"
                style={{ border: '1px solid var(--border)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => overrideItem(
                  overrideModal.itemId,
                  overrideModal.action === 'aprovar' ? 'atendido' : 'gap',
                  overrideModal.note || undefined,
                )}
                disabled={submitting === overrideModal.itemId}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                  overrideModal.action === 'aprovar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting === overrideModal.itemId
                  ? 'Salvando…'
                  : overrideModal.action === 'aprovar' ? 'Confirmar aprovação' : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  submitting,
  onOverride,
  onExceptionalOverride,
}: {
  item: CrossingItem
  submitting: string | null
  onOverride: (itemId: string, action: 'aprovar' | 'rejeitar', label: string) => void
  onExceptionalOverride: (itemId: string, resultado: string) => void
}) {
  const isPendente = item.resultado === 'atendido_parcialmente' && !item.humanOverride
  const isAtendido = item.resultado === 'atendido'
  const isGap      = item.resultado === 'gap'

  const accentColor = isPendente ? '#f59e0b' : isAtendido ? '#10b981' : '#dc2626'
  const scorePercent = item.scoreSimilaridadeMax
    ? `${(parseFloat(item.scoreSimilaridadeMax) * 100).toFixed(0)}%`
    : '—'
  const scoreColor  = isPendente ? 'text-amber-500' : isAtendido ? 'text-emerald-500' : 'text-red-500'

  const statusIcon   = isPendente ? 'pending'      : isAtendido ? 'check_circle' : 'cancel'
  const statusColor  = isPendente ? 'text-amber-500' : isAtendido ? 'text-emerald-500' : 'text-red-500'
  const badgeLabel   = isPendente ? 'Aguardando Revisão' : isAtendido ? 'Atendido' : 'GAP Crítico'
  const badgeClass   = isPendente
    ? 'bg-amber-100 text-amber-700'
    : isAtendido
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-red-50 text-red-600'

  return (
    <div
      className="overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md"
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      <div className="p-6">
        {/* Top row */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex gap-3">
            {/* Status icon */}
            <div className="mt-0.5 shrink-0">
              <span
                className={`material-symbols-outlined text-[22px] ${statusColor}`}
                style={{ fontVariationSettings: isAtendido ? "'FILL' 1" : "'FILL' 0" }}
              >
                {statusIcon}
              </span>
            </div>
            {/* Title + badge */}
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h4 className="font-bold text-[#003746]">{item.parcelaServico}</h4>
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${badgeClass}`}>
                  {badgeLabel}
                </span>
                {item.humanOverride && (
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600">
                    Revisado manualmente
                  </span>
                )}
              </div>
              {item.parcelaQuantidadeMinima && (
                <p className="text-xs text-slate-500">
                  Quantidade mínima:{' '}
                  <span className="font-semibold tabular-nums text-slate-700">
                    {item.parcelaQuantidadeMinima} {item.parcelaUnidade ?? ''}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Match % */}
          <div className="shrink-0 text-right">
            <span className={`block text-2xl font-black ${scoreColor}`}>{scorePercent}</span>
            <span className="text-[10px] font-bold uppercase text-slate-400">Match IA</span>
          </div>
        </div>

        {/* AI doubt box — pendentes */}
        {isPendente && item.aiJustificativa && (
          <div className="mb-4 rounded-lg border border-amber-200/60 bg-amber-50/50 p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[20px] text-amber-500">lightbulb</span>
              <div>
                <p className="mb-1 text-sm font-semibold text-amber-700">Dúvida Técnica da IA:</p>
                <p className="text-sm italic leading-relaxed text-amber-800/80">&ldquo;{item.aiJustificativa}&rdquo;</p>
              </div>
            </div>
          </div>
        )}

        {/* AI justification — non-pending */}
        {!isPendente && item.aiJustificativa && (
          <p className="mb-3 text-xs italic leading-relaxed text-slate-500">{item.aiJustificativa}</p>
        )}

        {/* Override note */}
        {item.humanOverride && item.humanOverrideNote && (
          <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-700">
            <span className="font-semibold">Nota: </span>{item.humanOverrideNote}
          </div>
        )}

        {/* GAP diagnostic */}
        {isGap && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50/40 p-4">
            <h5 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-red-600">
              Diagnóstico de Ausência
            </h5>
            <p className="mb-3 text-sm leading-relaxed text-red-800/70">
              {item.aiJustificativa
                ? item.aiJustificativa
                : 'Nenhuma CAT cadastrada cobre este tipo de serviço.'}
            </p>
            <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-white p-3 shadow-sm">
              <span className="material-symbols-outlined text-[20px] text-[#003746]">psychiatry</span>
              <p className="flex-1 text-xs text-slate-600">
                <span className="font-semibold text-[#003746]">Sugestão: </span>
                Considere obter nova CAT via consórcio, ou verifique se há possibilidade de complementação de acervo.
              </p>
            </div>
          </div>
        )}

        {/* CAT matches */}
        <CatMatchesCard item={item} />

        {/* Review actions — pendentes */}
        {isPendente && (
          <div className="mt-4 flex gap-3" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '16px' }}>
            <button
              onClick={() => onOverride(item.id, 'aprovar', item.parcelaServico)}
              disabled={submitting === item.id}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">check</span>
              Aprovar — Atende
            </button>
            <button
              onClick={() => onOverride(item.id, 'rejeitar', item.parcelaServico)}
              disabled={submitting === item.id}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              Rejeitar — é Gap
            </button>
          </div>
        )}

        {/* Reclassify button — non-pending */}
        {!isPendente && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => onExceptionalOverride(item.id, isAtendido ? 'gap' : 'atendido')}
              disabled={submitting === item.id}
              title={isAtendido ? 'Reclassificar como Gap' : 'Reclassificar como Atendido'}
              className="rounded p-1 text-slate-300 transition-colors hover:bg-slate-50 hover:text-slate-500 disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
