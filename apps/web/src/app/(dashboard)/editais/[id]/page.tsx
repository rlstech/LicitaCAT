'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Edital {
  id: string
  fileName: string
  orgaoLicitante: string | null
  uasg: string | null
  numeroEdital: string | null
  modalidade: string | null
  objeto: string | null
  valorEstimado: string | null
  dataAbertura: string | null
  status: string
  regimeExecucao: string | null
  leiRegente: string | null
  admiteConsorcio: boolean | null
  prazoExecucaoMeses: number | null
  aiExtractionCostUsd: string | null
  createdAt: string
}

interface Habilitacao {
  habilitacaoJuridica: Array<{ id: string; documento: string; aplicaA: string | null; observacao: string | null }>
  regularidadeFiscal: Array<{ id: string; documento: string; sigla: string | null; validadeDias: number | null; observacao: string | null }>
  qualificacaoTecnica: {
    registroConselho: string | null
    exigeVisitaTecnica: boolean
    visitaTipo: string | null
    exigeEscritorioLocal: boolean
    escritorioDescricao: string | null
  } | null
  profissionais: Array<{ id: string; cargo: string; conselho: string | null; quantidade: number | null; cbo: string | null; observacao: string | null }>
  parcelasRelevancia: Array<{ id: string; servico: string; unidade: string | null; quantidadeMinima: string | null; observacao: string | null }>
  atestadosProfissionais: Array<{ id: string; profissional: string; caracteristicasExigidas: string | null; exigeCat: boolean; observacao: string | null }>
  qualificacaoFinanceira: {
    exigeBalanco: boolean
    balancoExercicios: number | null
    patrimonioLiquidoMinimo: string | null
    lcMinimo: string | null
    lgMinimo: string | null
    sgMinimo: string | null
    exigeCertidaoFalencia: boolean
    certidaoFalenciaPrazoDias: number | null
    exigeCapitalSocialMinimo: boolean
    capitalSocialMinimo: string | null
    exigeGarantiaProposta: boolean
    garantiaPropostaPercentual: string | null
    observacao: string | null
  } | null
  declaracoes: Array<{ id: string; descricao: string; baseLegal: string | null; leiEstadual: boolean; penalidadeOmissao: string | null }>
  declaracoesEspeciais: Array<{ id: string; descricao: string; lei: string | null; uf: string | null }>
  alertas: Array<{ id: string; nivel: string; categoria: string | null; descricao: string }>
  anexosReferenciados: Array<{ id: string; identificacao: string; descricao: string | null }>
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const STATUS_STEPS = ['uploaded', 'extracting', 'review_pending', 'ready'] as const
const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Enviado',
  ocr_processing: 'Processando',
  extracting: 'Extraindo',
  review_pending: 'Revisão',
  ready: 'Pronto',
  error: 'Erro',
}
const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  uploaded: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  ocr_processing: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  extracting: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  review_pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  ready: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  error: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
}

const MODALIDADE_LABELS: Record<string, string> = {
  pregao_eletronico: 'Pregão Eletrônico',
  pregao_presencial: 'Pregão Presencial',
  concorrencia: 'Concorrência',
  tomada_de_precos: 'Tomada de Preços',
  convite: 'Convite',
  leilao: 'Leilão',
  concurso: 'Concurso',
  rdc: 'RDC',
  credenciamento: 'Credenciamento',
  outro: 'Outro',
}

const ALERTA_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string; label: string }> = {
  critico: { icon: '🚨', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: 'Crítico' },
  atencao: { icon: '⚠️', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Atenção' },
  informacao: { icon: 'ℹ️', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Informação' },
}

// Section accent colors [border-left, icon-bg, title-color]
const SECTION_ACCENTS: Record<number, { border: string; iconBg: string; titleColor: string }> = {
  1: { border: 'border-blue-500', iconBg: 'bg-blue-50', titleColor: 'text-blue-800' },
  2: { border: 'border-green-500', iconBg: 'bg-green-50', titleColor: 'text-green-800' },
  3: { border: 'border-amber-500', iconBg: 'bg-amber-50', titleColor: 'text-amber-800' },
  4: { border: 'border-indigo-500', iconBg: 'bg-indigo-50', titleColor: 'text-indigo-800' },
  5: { border: 'border-brand-600', iconBg: 'bg-brand-50', titleColor: 'text-brand-800' },
  6: { border: 'border-purple-500', iconBg: 'bg-purple-50', titleColor: 'text-purple-800' },
  7: { border: 'border-teal-500', iconBg: 'bg-teal-50', titleColor: 'text-teal-800' },
  8: { border: 'border-gray-400', iconBg: 'bg-gray-50', titleColor: 'text-gray-700' },
  9: { border: 'border-violet-500', iconBg: 'bg-violet-50', titleColor: 'text-violet-800' },
  10: { border: 'border-slate-400', iconBg: 'bg-slate-50', titleColor: 'text-slate-700' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE['uploaded']!
  const isAnimating = ['uploaded', 'extracting', 'ocr_processing'].includes(status)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${cfg.bg} ${cfg.text}`}>
      <span className="relative flex h-2 w-2">
        {isAnimating && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.dot}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
      </span>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function StatusStepper({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status as typeof STATUS_STEPS[number])
  return (
    <div className="flex items-center gap-0">
      {STATUS_STEPS.map((step, idx) => {
        const isDone = currentIdx > idx
        const isCurrent = currentIdx === idx
        const label = STATUS_LABELS[step] ?? step
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors
                ${isDone ? 'bg-brand-600 text-white' : isCurrent ? 'border-2 border-brand-600 text-brand-600 bg-white' : 'border-2 border-gray-200 text-gray-400 bg-white'}`}
              >
                {isDone ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span className={`mt-1 text-xs whitespace-nowrap ${isCurrent ? 'font-semibold text-brand-700' : isDone ? 'text-brand-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`mb-4 h-0.5 w-8 sm:w-12 ${isDone || (isCurrent && currentIdx > 0) ? 'bg-brand-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function MetaCardLarge({ icon, label, value, sub }: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  sub?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-0.5 truncate text-base font-semibold text-gray-900">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

function Section({ num, title, count, children, highlight }: {
  num: number
  title: string
  count?: number
  children: React.ReactNode
  highlight?: boolean
}) {
  const [open, setOpen] = useState(true)
  const accent = SECTION_ACCENTS[num] ?? SECTION_ACCENTS[1]!
  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${highlight ? 'ring-2 ring-brand-200' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${accent.iconBg} ${accent.titleColor} border-l-4 ${accent.border}`}>
            {num}
          </div>
          <span className={`text-sm font-semibold ${accent.titleColor}`}>{title}</span>
          {count !== undefined && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{count}</span>
          )}
          {highlight && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
              base para cruzamento
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className={`border-t border-gray-100 px-5 pb-5 pt-4 border-l-4 ${accent.border}`}>
          {children}
        </div>
      )}
    </div>
  )
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="bg-gray-50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</th>
}

function Td({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td className={`px-3 py-3 ${strong ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
      {children}
    </td>
  )
}

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: 'green' | 'red' | 'gray' | 'blue' | 'purple' }) {
  const colors = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

function KV({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-brand-700' : 'text-gray-800'}`}>{value ?? '—'}</span>
    </div>
  )
}

function ParcelaCard({ servico, unidade, quantidadeMinima, observacao }: {
  servico: string
  unidade: string | null
  quantidadeMinima: string | null
  observacao: string | null
}) {
  const qty = quantidadeMinima ? parseFloat(quantidadeMinima) : null
  const qtyFormatted = qty !== null
    ? qty >= 1000
      ? qty.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
      : qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
    : null

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 transition-shadow hover:shadow-md">
      <p className="text-sm font-medium leading-snug text-brand-900">{servico}</p>
      {observacao && <p className="mt-1 text-xs text-brand-600 opacity-80">{observacao}</p>}
      <div className="mt-4 flex items-end justify-between">
        {qtyFormatted ? (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-brand-500">Qtd mínima</span>
            <p className="text-2xl font-bold tabular-nums text-brand-700">
              {qtyFormatted}
              {unidade && <span className="ml-1 text-sm font-medium text-brand-500">{unidade}</span>}
            </p>
          </div>
        ) : (
          <div>
            <span className="text-xs text-brand-400">Qtd não especificada</span>
            {unidade && <p className="text-sm font-medium text-brand-600">{unidade}</p>}
          </div>
        )}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EditalDetailPage() {
  const { getToken, isLoaded } = useAuth()
  const params = useParams()
  const router = useRouter()
  const editalId = params.id as string
  const actionBarRef = useRef<HTMLDivElement>(null)

  const [edital, setEdital] = useState<Edital | null>(null)
  const [habilitacao, setHabilitacao] = useState<Habilitacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [triggeringCrossing, setTriggeringCrossing] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [objetoExpanded, setObjetoExpanded] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const token = await getToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
      const editalRes = await fetch(`${API_URL}/api/editais/${editalId}`, { headers })
      if (editalRes.ok) {
        const e = await editalRes.json() as Edital
        setEdital(e)
        if (e.status === 'review_pending' || e.status === 'ready') {
          const habRes = await fetch(`${API_URL}/api/editais/${editalId}/habilitacao`, { headers })
          if (habRes.ok) setHabilitacao(await habRes.json() as Habilitacao)
        }
      }
    } catch { /* fail silently */ }
    finally { setLoading(false) }
  }, [getToken, editalId])

  useEffect(() => {
    if (!isLoaded) return
    fetchData()
    const interval = setInterval(() => {
      if (!edital || ['uploaded', 'extracting'].includes(edital.status)) fetchData()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchData, isLoaded, edital?.status])

  async function approveEdital() {
    setApproving(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/editais/${editalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) setEdital((prev) => prev ? { ...prev, status: 'ready' } : prev)
    } catch { /* ignore */ }
    finally { setApproving(false) }
  }

  async function triggerCrossing() {
    setTriggeringCrossing(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/crossings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ editalId }),
      })
      if (res.ok) {
        const data = await res.json() as { crossingId: string }
        router.push(`/cruzamentos/${data.crossingId}`)
      }
    } catch { /* ignore */ }
    finally { setTriggeringCrossing(false) }
  }

  async function deleteEdital() {
    setDeleting(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/editais/${editalId}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) router.push('/editais')
    } catch { /* ignore */ }
    finally { setDeleting(false); setConfirmDelete(false) }
  }

  async function reprocessEdital() {
    setReprocessing(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/editais/${editalId}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) setEdital((prev) => prev ? { ...prev, status: 'extracting' } : prev)
    } catch { /* ignore */ }
    finally { setReprocessing(false) }
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <Spinner className="h-8 w-8 text-brand-600" />
        <p className="text-sm text-gray-400">Carregando edital…</p>
      </div>
    )
  }

  if (!edital) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-gray-600 font-medium">Edital não encontrado</p>
        <Link href="/editais" className="text-sm text-brand-600 hover:text-brand-700">← Voltar para editais</Link>
      </div>
    )
  }

  const isProcessing = ['uploaded', 'extracting', 'ocr_processing'].includes(edital.status)
  const hasActions = edital.status === 'review_pending' || edital.status === 'ready' || edital.status === 'error'
  const objetoLong = (edital.objeto?.length ?? 0) > 200

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">

      {/* ── Breadcrumb ── */}
      <Link href="/editais" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Editais
      </Link>

      {/* ── Hero card ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Top bar with gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-600 via-brand-400 to-blue-300" />

        <div className="px-6 py-5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold text-gray-900">
                {edital.numeroEdital ?? edital.fileName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                {edital.orgaoLicitante && (
                  <span className="font-medium text-gray-700">{edital.orgaoLicitante}</span>
                )}
                {edital.uasg && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">UASG {edital.uasg}</span>
                  </>
                )}
                {edital.numeroEdital && edital.fileName !== edital.numeroEdital && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-400">{edital.fileName}</span>
                  </>
                )}
              </div>
            </div>
            <StatusBadge status={edital.status} />
          </div>

          {/* Stepper — hide on error */}
          {edital.status !== 'error' && (
            <div className="mt-5 flex items-start">
              <StatusStepper status={edital.status} />
            </div>
          )}

          {/* Error banner */}
          {edital.status === 'error' && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-700">Ocorreu um erro durante a extração. Use o botão Reprocessar para tentar novamente.</p>
            </div>
          )}

          {/* Processing banner */}
          {isProcessing && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <Spinner className="h-4 w-4 shrink-0 text-blue-600" />
              <p className="text-sm text-blue-800">
                {edital.status === 'uploaded'
                  ? 'O edital está na fila de processamento. Esta página atualiza automaticamente.'
                  : 'Extraindo dados de habilitação com IA. Esta página atualiza automaticamente…'}
              </p>
            </div>
          )}
        </div>

        {/* ── Action bar ── */}
        {hasActions && (
          <div ref={actionBarRef} className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-3">
            {/* Delete */}
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Confirmar exclusão?</span>
                <button
                  onClick={deleteEdital}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Excluindo…' : 'Sim, excluir'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-500 hover:border-red-200 hover:text-red-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Excluir
              </button>
            )}

            {edital.status === 'error' && (
              <button
                onClick={reprocessEdital}
                disabled={reprocessing}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
              >
                {reprocessing ? <Spinner className="h-4 w-4" /> : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                )}
                {reprocessing ? 'Reprocessando…' : 'Reprocessar'}
              </button>
            )}

            {edital.status === 'review_pending' && (
              <button
                onClick={approveEdital}
                disabled={approving}
                className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
              >
                {approving ? <Spinner className="h-4 w-4" /> : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {approving ? 'Aprovando…' : 'Aprovar Extração'}
              </button>
            )}

            {edital.status === 'ready' && (
              <button
                onClick={triggerCrossing}
                disabled={triggeringCrossing}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {triggeringCrossing ? <Spinner className="h-4 w-4" /> : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                )}
                {triggeringCrossing ? 'Iniciando…' : 'Iniciar Cruzamento'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Tier 1 — Key metadata cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetaCardLarge
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Valor Estimado"
          value={edital.valorEstimado ? `R$ ${parseFloat(edital.valorEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null}
        />
        <MetaCardLarge
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
          label="Data de Abertura"
          value={edital.dataAbertura ? new Date(edital.dataAbertura).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : null}
        />
        <MetaCardLarge
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>}
          label="Modalidade"
          value={edital.modalidade ? (MODALIDADE_LABELS[edital.modalidade] ?? edital.modalidade) : null}
        />
        <MetaCardLarge
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Prazo de Execução"
          value={edital.prazoExecucaoMeses ? `${edital.prazoExecucaoMeses} meses` : null}
        />
      </div>

      {/* ── Tier 2 — Secondary metadata (horizontal) ── */}
      {(edital.regimeExecucao || edital.leiRegente || edital.admiteConsorcio != null) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm shadow-sm">
          {edital.regimeExecucao && (
            <div className="flex items-center gap-1.5 text-gray-600">
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Regime</span>
              <span className="font-medium text-gray-800">{edital.regimeExecucao}</span>
            </div>
          )}
          {edital.leiRegente && (
            <>
              <span className="text-gray-200">|</span>
              <div className="flex items-center gap-1.5 text-gray-600">
                <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Lei</span>
                <span className="font-medium text-gray-800">{edital.leiRegente}</span>
              </div>
            </>
          )}
          {edital.admiteConsorcio != null && (
            <>
              <span className="text-gray-200">|</span>
              <div className="flex items-center gap-1.5 text-gray-600">
                <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Consórcio</span>
                <Badge color={edital.admiteConsorcio ? 'green' : 'gray'}>{edital.admiteConsorcio ? 'Admite' : 'Não admite'}</Badge>
              </div>
            </>
          )}
          {edital.createdAt && (
            <>
              <span className="text-gray-200">|</span>
              <div className="flex items-center gap-1.5 text-gray-500">
                <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Enviado em</span>
                <span className="text-xs text-gray-500">{new Date(edital.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Objeto ── */}
      {edital.objeto && (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Objeto da Licitação</span>
          </div>
          <p className={`text-sm leading-relaxed text-gray-800 ${!objetoExpanded && objetoLong ? 'line-clamp-3' : ''}`}>
            {edital.objeto}
          </p>
          {objetoLong && (
            <button
              onClick={() => setObjetoExpanded((v) => !v)}
              className="mt-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {objetoExpanded ? 'Mostrar menos ↑' : 'Ver mais ↓'}
            </button>
          )}
        </div>
      )}

      {/* ── Habilitação data ── */}
      {habilitacao && (
        <div className="space-y-4">

          {/* Alertas */}
          {habilitacao.alertas.length > 0 && (
            <div className="space-y-2">
              {habilitacao.alertas.map((alerta) => {
                const cfg = ALERTA_CONFIG[alerta.nivel] ?? ALERTA_CONFIG['informacao']!
                return (
                  <div key={alerta.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cfg.bg} ${cfg.border}`}>
                    <span className="text-lg leading-none">{cfg.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                        {alerta.categoria && <span className="text-xs text-gray-400">{alerta.categoria}</span>}
                      </div>
                      <p className={`mt-0.5 text-sm ${cfg.color}`}>{alerta.descricao}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 1. Habilitação Jurídica */}
          {habilitacao.habilitacaoJuridica.length > 0 && (
            <Section num={1} title="Habilitação Jurídica" count={habilitacao.habilitacaoJuridica.length}>
              <TableWrapper>
                <thead>
                  <tr><Th>Documento</Th><Th>Aplica a</Th><Th>Observação</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {habilitacao.habilitacaoJuridica.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <Td strong>{item.documento}</Td>
                      <Td>{item.aplicaA ?? <span className="text-gray-300">—</span>}</Td>
                      <Td>{item.observacao ?? <span className="text-gray-300">—</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </Section>
          )}

          {/* 2. Regularidade Fiscal */}
          {habilitacao.regularidadeFiscal.length > 0 && (
            <Section num={2} title="Regularidade Fiscal, Social e Trabalhista" count={habilitacao.regularidadeFiscal.length}>
              <TableWrapper>
                <thead>
                  <tr><Th>Documento</Th><Th>Sigla</Th><Th>Validade</Th><Th>Observação</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {habilitacao.regularidadeFiscal.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <Td strong>{item.documento}</Td>
                      <Td>{item.sigla ? <Badge color="blue">{item.sigla}</Badge> : <span className="text-gray-300">—</span>}</Td>
                      <Td>{item.validadeDias ? `${item.validadeDias} dias` : <span className="text-gray-300">—</span>}</Td>
                      <Td>{item.observacao ?? <span className="text-gray-300">—</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </Section>
          )}

          {/* 3. Qualificação Técnica */}
          {habilitacao.qualificacaoTecnica && (
            <Section num={3} title="Qualificação Técnica — Dados Gerais">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
                <KV label="Registro Conselho" value={habilitacao.qualificacaoTecnica.registroConselho} />
                <KV
                  label="Visita Técnica"
                  value={habilitacao.qualificacaoTecnica.exigeVisitaTecnica
                    ? (habilitacao.qualificacaoTecnica.visitaTipo === 'obrigatoria' ? 'Obrigatória' : 'Facultativa')
                    : 'Não exigida'}
                />
                <KV
                  label="Escritório Local"
                  value={habilitacao.qualificacaoTecnica.exigeEscritorioLocal
                    ? (habilitacao.qualificacaoTecnica.escritorioDescricao ?? 'Exigido')
                    : 'Não exigido'}
                />
              </div>
            </Section>
          )}

          {/* 4. Profissionais Exigidos */}
          {habilitacao.profissionais.length > 0 && (
            <Section num={4} title="Profissionais Exigidos" count={habilitacao.profissionais.length}>
              <TableWrapper>
                <thead>
                  <tr><Th>Cargo / Função</Th><Th>Conselho</Th><Th>Qtd</Th><Th>CBO</Th><Th>Observação</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {habilitacao.profissionais.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <Td strong>{item.cargo}</Td>
                      <Td>{item.conselho ? <Badge color="blue">{item.conselho}</Badge> : <span className="text-gray-300">—</span>}</Td>
                      <Td>{item.quantidade != null ? <span className="font-semibold">{item.quantidade}</span> : <span className="text-gray-300">—</span>}</Td>
                      <Td>{item.cbo ?? <span className="text-gray-300">—</span>}</Td>
                      <Td>{item.observacao ?? <span className="text-gray-300">—</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </Section>
          )}

          {/* 5. Parcelas de Relevância — STAR SECTION */}
          <Section num={5} title="Parcelas de Relevância" count={habilitacao.parcelasRelevancia.length} highlight>
            {habilitacao.parcelasRelevancia.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12" />
                </svg>
                <p className="text-sm text-gray-400">Nenhuma parcela de relevância extraída para este edital.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {habilitacao.parcelasRelevancia.map((item) => (
                  <ParcelaCard key={item.id} {...item} />
                ))}
              </div>
            )}
          </Section>

          {/* 6. Atestados de Profissionais */}
          {habilitacao.atestadosProfissionais.length > 0 && (
            <Section num={6} title="Atestados de Profissionais" count={habilitacao.atestadosProfissionais.length}>
              <TableWrapper>
                <thead>
                  <tr><Th>Profissional</Th><Th>Características Exigidas</Th><Th>CAT</Th><Th>Observação</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {habilitacao.atestadosProfissionais.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <Td strong>{item.profissional}</Td>
                      <Td>{item.caracteristicasExigidas ?? <span className="text-gray-300">—</span>}</Td>
                      <Td>
                        <Badge color={item.exigeCat ? 'purple' : 'gray'}>{item.exigeCat ? 'Exige CAT' : 'Não exige'}</Badge>
                      </Td>
                      <Td>{item.observacao ?? <span className="text-gray-300">—</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </Section>
          )}

          {/* 7. Qualificação Econômico-Financeira */}
          {habilitacao.qualificacaoFinanceira && (
            <Section num={7} title="Qualificação Econômico-Financeira">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
                <KV label="Balanço Patrimonial"
                  value={habilitacao.qualificacaoFinanceira.exigeBalanco
                    ? `Sim — ${habilitacao.qualificacaoFinanceira.balancoExercicios ?? '?'} exercício(s)`
                    : 'Não exigido'} />
                <KV label="Patrimônio Líquido Mín."
                  value={habilitacao.qualificacaoFinanceira.patrimonioLiquidoMinimo
                    ? `R$ ${parseFloat(habilitacao.qualificacaoFinanceira.patrimonioLiquidoMinimo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : null} />
                <KV label="LC Mínimo" value={habilitacao.qualificacaoFinanceira.lcMinimo} />
                <KV label="LG Mínimo" value={habilitacao.qualificacaoFinanceira.lgMinimo} />
                <KV label="SG Mínimo" value={habilitacao.qualificacaoFinanceira.sgMinimo} />
                <KV label="Certidão de Falência"
                  value={habilitacao.qualificacaoFinanceira.exigeCertidaoFalencia
                    ? `Sim${habilitacao.qualificacaoFinanceira.certidaoFalenciaPrazoDias ? ` — ${habilitacao.qualificacaoFinanceira.certidaoFalenciaPrazoDias} dias` : ''}`
                    : 'Não exigida'} />
                <KV label="Capital Social Mín."
                  value={habilitacao.qualificacaoFinanceira.capitalSocialMinimo
                    ? `R$ ${parseFloat(habilitacao.qualificacaoFinanceira.capitalSocialMinimo).toLocaleString('pt-BR')}`
                    : null} />
                <KV label="Garantia de Proposta"
                  value={habilitacao.qualificacaoFinanceira.exigeGarantiaProposta
                    ? `${habilitacao.qualificacaoFinanceira.garantiaPropostaPercentual ?? '?'}%`
                    : 'Não exigida'} />
              </div>
              {habilitacao.qualificacaoFinanceira.observacao && (
                <p className="mt-4 border-t border-gray-100 pt-3 text-xs italic text-gray-400">{habilitacao.qualificacaoFinanceira.observacao}</p>
              )}
            </Section>
          )}

          {/* 8. Declarações */}
          {habilitacao.declaracoes.length > 0 && (
            <Section num={8} title="Declarações" count={habilitacao.declaracoes.length}>
              <ul className="space-y-2">
                {habilitacao.declaracoes.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 hover:bg-gray-100 transition-colors">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800">{item.descricao}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {item.baseLegal && <Badge color="gray">{item.baseLegal}</Badge>}
                        {item.leiEstadual && <Badge color="purple">Lei Estadual</Badge>}
                        {item.penalidadeOmissao && <span className="text-xs text-red-500">Penalidade: {item.penalidadeOmissao}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 9. Declarações por Lei Estadual */}
          {habilitacao.declaracoesEspeciais.length > 0 && (
            <Section num={9} title="Declarações por Lei Estadual" count={habilitacao.declaracoesEspeciais.length}>
              <ul className="space-y-2">
                {habilitacao.declaracoesEspeciais.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2.5">
                    <Badge color="purple">{item.uf ?? 'UF'}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800">{item.descricao}</p>
                      {item.lei && <p className="mt-0.5 text-xs text-gray-400">{item.lei}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 10. Anexos */}
          {habilitacao.anexosReferenciados.length > 0 && (
            <Section num={10} title="Anexos Referenciados" count={habilitacao.anexosReferenciados.length}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {habilitacao.anexosReferenciados.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    <div>
                      <span className="text-xs font-semibold text-gray-700">{item.identificacao}</span>
                      {item.descricao && <p className="text-xs text-gray-400">{item.descricao}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── Cost footnote ── */}
      {edital.aiExtractionCostUsd && (
        <p className="text-center text-xs text-gray-300">
          Custo de extração: ${edital.aiExtractionCostUsd} USD
        </p>
      )}
    </div>
  )
}
