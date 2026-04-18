'use client'

import { useEffect, useState, useCallback } from 'react'
import { useToken } from '@/hooks/use-token'
import { useSession } from '@/lib/auth-client'
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

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  uploaded:       { label: 'Na fila',          bg: 'bg-slate-100',   text: 'text-slate-600',  dot: 'bg-gray-400' },
  ocr_processing: { label: 'Processando',       bg: 'bg-yellow-50',  text: 'text-yellow-700', dot: 'bg-yellow-500' },
  extracting:     { label: 'Extraindo',         bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500' },
  review_pending: { label: 'Revisão pendente',  bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500' },
  ready:          { label: 'Pronto',            bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500' },
  error:          { label: 'Erro',              bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500' },
}

const MODALIDADE_LABELS: Record<string, string> = {
  pregao_eletronico: 'Pregão Eletrônico',
  pregao_presencial: 'Pregão Presencial',
  concorrencia:      'Concorrência',
  tomada_de_precos:  'Tomada de Preços',
  convite:           'Convite',
  leilao:            'Leilão',
  concurso:          'Concurso',
  rdc:               'RDC',
  credenciamento:    'Credenciamento',
  outro:             'Outro',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(val: string | null) {
  if (!val) return null
  return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(val: string | null) {
  if (!val) return null
  return new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Small components ─────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="material-symbols-outlined text-4xl text-slate-200">description</span>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function DocRow({ icon, title, subtitle, badge }: {
  icon: string
  title: string
  subtitle?: string | null
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="material-symbols-outlined shrink-0 text-[1.1rem] text-slate-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-slate-800">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'juridica',      label: 'Jurídica & Fiscal',     icon: 'gavel' },
  { key: 'tecnica',       label: 'Qualif. Técnica',        icon: 'engineering' },
  { key: 'profissionais', label: 'Profissionais',          icon: 'person' },
  { key: 'parcelas',      label: 'Parcelas de Relevância', icon: 'bar_chart' },
  { key: 'atestados',     label: 'Atestados',              icon: 'verified_user' },
  { key: 'financeira',    label: 'Financeira',             icon: 'account_balance' },
  { key: 'alertas',       label: 'Alertas',                icon: 'warning' },
] as const

type TabKey = typeof TABS[number]['key']

// ─── Tab content components ───────────────────────────────────────────────────

function TabJuridica({ hab }: { hab: Habilitacao }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Habilitação Jurídica</h3>
        {hab.habilitacaoJuridica.length === 0
          ? <EmptyState message="Nenhum documento de habilitação jurídica extraído." />
          : (
            <div className="space-y-2">
              {hab.habilitacaoJuridica.map((item) => (
                <DocRow key={item.id} icon="gavel" title={item.documento}
                  subtitle={[item.aplicaA, item.observacao].filter(Boolean).join(' — ')} />
              ))}
            </div>
          )}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Regularidade Fiscal, Social e Trabalhista</h3>
        {hab.regularidadeFiscal.length === 0
          ? <EmptyState message="Nenhum documento de regularidade fiscal extraído." />
          : (
            <div className="space-y-2">
              {hab.regularidadeFiscal.map((item) => (
                <DocRow
                  key={item.id}
                  icon="account_balance"
                  title={item.documento}
                  subtitle={item.observacao ?? (item.validadeDias ? `Validade: ${item.validadeDias} dias` : null)}
                  badge={item.sigla ? (
                    <span className="rounded-full bg-[#e6f6ff] px-2 py-0.5 text-xs font-bold text-[#003746]">{item.sigla}</span>
                  ) : undefined}
                />
              ))}
            </div>
          )}
      </div>

      {hab.declaracoes.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Declarações</h3>
          <div className="space-y-2">
            {hab.declaracoes.map((item) => (
              <DocRow
                key={item.id}
                icon="description"
                title={item.descricao}
                subtitle={[item.baseLegal, item.penalidadeOmissao ? `Penalidade: ${item.penalidadeOmissao}` : null].filter(Boolean).join(' · ')}
                badge={item.leiEstadual ? (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">Lei Estadual</span>
                ) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {hab.declaracoesEspeciais.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Declarações por Lei Estadual</h3>
          <div className="space-y-2">
            {hab.declaracoesEspeciais.map((item) => (
              <DocRow
                key={item.id}
                icon="article"
                title={item.descricao}
                subtitle={item.lei}
                badge={item.uf ? (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">{item.uf}</span>
                ) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {hab.anexosReferenciados.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Anexos Referenciados</h3>
          <div className="space-y-2">
            {hab.anexosReferenciados.map((item) => (
              <DocRow key={item.id} icon="attach_file" title={item.identificacao} subtitle={item.descricao} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TabTecnica({ hab }: { hab: Habilitacao }) {
  const qt = hab.qualificacaoTecnica
  if (!qt) return <EmptyState message="Nenhum dado de qualificação técnica extraído." />
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {qt.registroConselho && (
        <InfoCard label="Registro Conselho" value={qt.registroConselho} />
      )}
      <InfoCard
        label="Visita Técnica"
        value={qt.exigeVisitaTecnica ? (qt.visitaTipo === 'obrigatoria' ? 'Obrigatória' : 'Facultativa') : 'Não exigida'}
      />
      <InfoCard
        label="Escritório Local"
        value={qt.exigeEscritorioLocal ? (qt.escritorioDescricao ?? 'Exigido') : 'Não exigido'}
      />
    </div>
  )
}

function TabProfissionais({ hab }: { hab: Habilitacao }) {
  if (hab.profissionais.length === 0) return <EmptyState message="Nenhum profissional exigido extraído." />
  return (
    <div className="space-y-2">
      {hab.profissionais.map((item) => (
        <DocRow
          key={item.id}
          icon="person"
          title={item.cargo}
          subtitle={[item.conselho, item.cbo, item.observacao].filter(Boolean).join(' · ')}
          badge={item.quantidade != null ? (
            <span className="rounded-full bg-[#e6f6ff] px-2.5 py-0.5 text-xs font-bold text-[#003746]">{item.quantidade}×</span>
          ) : undefined}
        />
      ))}
    </div>
  )
}

function TabParcelas({ hab }: { hab: Habilitacao }) {
  if (hab.parcelasRelevancia.length === 0) return <EmptyState message="Nenhuma parcela de relevância extraída." />
  return (
    <div className="space-y-2">
      {hab.parcelasRelevancia.map((item) => {
        const qty = item.quantidadeMinima ? parseFloat(item.quantidadeMinima) : null
        const qtyFmt = qty !== null ? qty.toLocaleString('pt-BR', { maximumFractionDigits: qty >= 100 ? 0 : 3 }) : null
        const subtitle = [
          qtyFmt ? `Qtd. mínima: ${qtyFmt}${item.unidade ? ` ${item.unidade}` : ''}` : null,
          item.observacao,
        ].filter(Boolean).join(' — ')
        return (
          <DocRow key={item.id} icon="bar_chart" title={item.servico} subtitle={subtitle || null} />
        )
      })}
    </div>
  )
}

function TabAtestados({ hab }: { hab: Habilitacao }) {
  if (hab.atestadosProfissionais.length === 0) return <EmptyState message="Nenhum atestado de profissional extraído." />
  return (
    <div className="space-y-2">
      {hab.atestadosProfissionais.map((item) => (
        <DocRow
          key={item.id}
          icon="verified_user"
          title={item.profissional}
          subtitle={item.caracteristicasExigidas ?? item.observacao}
          badge={
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              item.exigeCat ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {item.exigeCat ? 'Exige CAT' : 'Sem CAT'}
            </span>
          }
        />
      ))}
    </div>
  )
}

function TabFinanceira({ hab }: { hab: Habilitacao }) {
  const qf = hab.qualificacaoFinanceira
  if (!qf) return <EmptyState message="Nenhum requisito de qualificação financeira extraído." />
  const items = [
    { label: 'Balanço Patrimonial', value: qf.exigeBalanco ? `Sim — ${qf.balancoExercicios ?? '?'} exercício(s)` : 'Não exigido' },
    { label: 'Patrimônio Líquido Mín.', value: fmtBRL(qf.patrimonioLiquidoMinimo) },
    { label: 'LC Mínimo', value: qf.lcMinimo },
    { label: 'LG Mínimo', value: qf.lgMinimo },
    { label: 'SG Mínimo', value: qf.sgMinimo },
    { label: 'Certidão de Falência', value: qf.exigeCertidaoFalencia ? `Sim${qf.certidaoFalenciaPrazoDias ? ` — ${qf.certidaoFalenciaPrazoDias} dias` : ''}` : 'Não exigida' },
    { label: 'Capital Social Mín.', value: qf.capitalSocialMinimo ? fmtBRL(qf.capitalSocialMinimo) : null },
    { label: 'Garantia de Proposta', value: qf.exigeGarantiaProposta ? `${qf.garantiaPropostaPercentual ?? '?'}%` : 'Não exigida' },
  ].filter((item): item is { label: string; value: string } => !!item.value)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <InfoCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
      {qf.observacao && (
        <p className="border-t border-slate-100 pt-4 text-sm italic text-slate-400">{qf.observacao}</p>
      )}
    </div>
  )
}

function TabAlertas({ hab }: { hab: Habilitacao }) {
  if (hab.alertas.length === 0) return <EmptyState message="Nenhum alerta registrado para este edital." />
  const iconMap: Record<string, string> = { critico: 'error', atencao: 'warning', informacao: 'info' }
  const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    critico:    { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   icon: 'text-red-500' },
    atencao:    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
    informacao: { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700',  icon: 'text-blue-400' },
  }
  return (
    <div className="space-y-3">
      {hab.alertas.map((alerta) => {
        const cfg = colorMap[alerta.nivel] ?? colorMap['informacao']!
        return (
          <div key={alerta.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cfg.bg} ${cfg.border}`}>
            <span className={`material-symbols-outlined mt-0.5 shrink-0 text-[1.1rem] ${cfg.icon}`}>
              {iconMap[alerta.nivel] ?? 'info'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-wide ${cfg.text}`}>
                  {alerta.nivel === 'critico' ? 'Crítico' : alerta.nivel === 'atencao' ? 'Atenção' : 'Informação'}
                </span>
                {alerta.categoria && <span className="text-xs text-slate-400">{alerta.categoria}</span>}
              </div>
              <p className={`mt-0.5 text-sm ${cfg.text}`}>{alerta.descricao}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EditalDetailPage() {
  const getToken = useToken()
  const { isPending } = useSession()
  const params = useParams()
  const router = useRouter()
  const editalId = params.id as string

  const [edital, setEdital]           = useState<Edital | null>(null)
  const [habilitacao, setHabilitacao] = useState<Habilitacao | null>(null)
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<TabKey>('juridica')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [approving, setApproving]                   = useState(false)
  const [triggeringCrossing, setTriggeringCrossing] = useState(false)
  const [reprocessing, setReprocessing]             = useState(false)
  const [deleting, setDeleting]                     = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const token = await getToken()
      const h = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      const res = await fetch(`${API_URL}/api/editais/${editalId}`, { headers: h })
      if (!res.ok) return
      const e = await res.json() as Edital
      setEdital(e)
      if (e.status === 'review_pending' || e.status === 'ready') {
        const hr = await fetch(`${API_URL}/api/editais/${editalId}/habilitacao`, { headers: h })
        if (hr.ok) setHabilitacao(await hr.json() as Habilitacao)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [getToken, editalId])

  useEffect(() => {
    if (!!isPending) return
    fetchData()
    const iv = setInterval(() => {
      if (!edital || ['uploaded', 'extracting'].includes(edital.status)) fetchData()
    }, 5000)
    return () => clearInterval(iv)
  }, [fetchData, !isPending, edital?.status])

  async function approve() {
    setApproving(true)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/editais/${editalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: '{}',
      })
      if (r.ok) setEdital((p) => p ? { ...p, status: 'ready' } : p)
    } catch { /* ignore */ } finally { setApproving(false) }
  }

  async function startCrossing() {
    setTriggeringCrossing(true)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/crossings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ editalId }),
      })
      if (r.ok) {
        const d = await r.json() as { crossingId: string }
        router.push(`/cruzamentos/${d.crossingId}`)
      }
    } catch { /* ignore */ } finally { setTriggeringCrossing(false) }
  }

  async function reprocess() {
    setReprocessing(true)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/editais/${editalId}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: '{}',
      })
      if (r.ok) setEdital((p) => p ? { ...p, status: 'extracting' } : p)
    } catch { /* ignore */ } finally { setReprocessing(false) }
  }

  async function doDelete() {
    setDeleting(true)
    try {
      const token = await getToken()
      const r = await fetch(`${API_URL}/api/editais/${editalId}`, {
        method: 'DELETE', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (r.ok) router.push('/editais')
    } catch { /* ignore */ } finally { setDeleting(false); setConfirmDelete(false) }
  }

  // ── Loading / not found ───────────────────────────────────────────────────

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-3 py-32">
      <Spinner className="h-8 w-8 text-[#003746]" />
      <p className="text-sm text-slate-400">Carregando edital…</p>
    </div>
  )

  if (!edital) return (
    <div className="flex flex-col items-center justify-center gap-3 py-32">
      <p className="font-medium text-slate-600">Edital não encontrado.</p>
      <Link href="/editais" className="text-sm text-[#003746] hover:underline">← Voltar para editais</Link>
    </div>
  )

  const status      = STATUS_CONFIG[edital.status] ?? STATUS_CONFIG['uploaded']!
  const isProcessing = ['uploaded', 'extracting', 'ocr_processing'].includes(edital.status)
  const criticalAlerts = habilitacao?.alertas.filter((a) => a.nivel === 'critico') ?? []
  const atencaoAlerts  = habilitacao?.alertas.filter((a) => a.nivel === 'atencao')  ?? []
  const firstAlert     = criticalAlerts[0] ?? atencaoAlerts[0] ?? null

  // Count per tab for badges
  const tabCounts: Partial<Record<TabKey, number>> = habilitacao ? {
    juridica:      habilitacao.habilitacaoJuridica.length + habilitacao.regularidadeFiscal.length,
    profissionais: habilitacao.profissionais.length,
    parcelas:      habilitacao.parcelasRelevancia.length,
    atestados:     habilitacao.atestadosProfissionais.length,
    alertas:       habilitacao.alertas.length,
  } : {}

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-12">

      {/* Breadcrumb */}
      <Link href="/editais" className="inline-flex items-center gap-0.5 text-sm text-slate-400 hover:text-slate-600">
        <span className="material-symbols-outlined text-[1.1rem]">chevron_left</span>
        Editais
      </Link>

      {/* ══════════════════════════════════════════
          HERO — 12-col grid
      ══════════════════════════════════════════ */}
      <div className="grid grid-cols-12 gap-4">

        {/* Left: metadata card */}
        <div className="col-span-12 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-8">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.bg} ${status.text}`}>
                  <span className="relative flex h-1.5 w-1.5">
                    {isProcessing && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${status.dot}`} />}
                    <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  </span>
                  {status.label}
                </span>
                {edital.leiRegente && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">{edital.leiRegente}</span>
                )}
              </div>
              <h1 className="mt-2 text-lg font-bold leading-tight text-slate-900">
                {edital.orgaoLicitante ?? edital.fileName}
              </h1>
              {edital.uasg && (
                <p className="mt-0.5 font-mono text-xs text-slate-400">UASG {edital.uasg}</p>
              )}
            </div>

            {/* Delete */}
            <div className="shrink-0">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Confirmar?</span>
                  <button onClick={doDelete} disabled={deleting}
                    className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                    {deleting ? 'Excluindo…' : 'Excluir'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition-colors hover:border-red-200 hover:text-red-500">
                  <span className="material-symbols-outlined text-[1.1rem]">delete</span>
                </button>
              )}
            </div>
          </div>

          {/* Key data grid */}
          <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
            {[
              { label: 'Nº Edital',       value: edital.numeroEdital },
              { label: 'Modalidade',      value: edital.modalidade ? (MODALIDADE_LABELS[edital.modalidade] ?? edital.modalidade) : null },
              { label: 'Abertura',        value: fmtDate(edital.dataAbertura) },
              { label: 'Valor Estimado',  value: fmtBRL(edital.valorEstimado) },
            ].map((f) => (
              <div key={f.label} className="bg-white px-5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{f.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">
                  {f.value ?? <span className="font-normal text-slate-300">—</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Objeto */}
          {edital.objeto && (
            <div className="border-t border-slate-100 px-6 py-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Objeto</p>
              <p className="text-sm leading-relaxed text-slate-700">{edital.objeto}</p>
            </div>
          )}

          {/* Processing banner */}
          {isProcessing && (
            <div className="flex items-center gap-2 border-t border-blue-100 bg-blue-50 px-6 py-3 text-sm text-blue-700">
              <Spinner className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              {edital.status === 'uploaded'
                ? 'Na fila de processamento. Esta página atualiza automaticamente.'
                : 'Extraindo dados de habilitação com IA. Atualizando automaticamente…'}
            </div>
          )}

          {/* Error banner */}
          {edital.status === 'error' && (
            <div className="border-t border-red-100 bg-red-50 px-6 py-3">
              <p className="text-sm text-red-700">Ocorreu um erro durante a extração. Use o botão Reprocessar para tentar novamente.</p>
            </div>
          )}
        </div>

        {/* Right: action card (dark brand) */}
        <div className="col-span-12 flex flex-col gap-5 rounded-2xl bg-[#003746] p-6 shadow-sm lg:col-span-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#7fb5c5]">Status da extração</p>
            <p className="mt-2 text-2xl font-bold text-white">{status.label}</p>
            <p className="mt-1 text-sm leading-snug text-[#a8d1de]">
              {edital.status === 'ready'
                ? 'Extração concluída. Inicie o cruzamento semântico com o acervo de CATs.'
                : edital.status === 'review_pending'
                ? 'A IA extraiu os dados de habilitação. Revise e aprove antes de cruzar.'
                : edital.status === 'error'
                ? 'Houve um problema na extração. Verifique e reprocesse.'
                : 'O edital está sendo processado pela IA…'}
            </p>
          </div>

          <div className="mt-auto space-y-2">
            {edital.status === 'error' && (
              <button onClick={reprocess} disabled={reprocessing}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.08)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.15)] disabled:opacity-50">
                {reprocessing
                  ? <Spinner className="h-4 w-4" />
                  : <span className="material-symbols-outlined text-[1.1rem]">refresh</span>}
                {reprocessing ? 'Reprocessando…' : 'Reprocessar'}
              </button>
            )}
            {edital.status === 'review_pending' && (
              <button onClick={approve} disabled={approving}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.08)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.15)] disabled:opacity-50">
                {approving
                  ? <Spinner className="h-4 w-4" />
                  : <span className="material-symbols-outlined text-[1.1rem]">check_circle</span>}
                {approving ? 'Aprovando…' : 'Aprovar extração'}
              </button>
            )}
            {edital.status === 'ready' && (
              <button onClick={startCrossing} disabled={triggeringCrossing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#003746] shadow-sm transition-colors hover:bg-[#e6f6ff] disabled:opacity-50">
                {triggeringCrossing
                  ? <Spinner className="h-4 w-4 text-[#003746]" />
                  : <span className="material-symbols-outlined text-[1.1rem]">compare_arrows</span>}
                {triggeringCrossing ? 'Iniciando…' : 'Iniciar Cruzamento'}
              </button>
            )}
          </div>

          {edital.aiExtractionCostUsd && (
            <p className="text-[10px] text-[#4d8a9e]">Custo de extração: ${edital.aiExtractionCostUsd} USD</p>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          TABS + CONTENT (only when habilitacao is loaded)
      ══════════════════════════════════════════ */}
      {habilitacao && (
        <div>
          {/* Tab bar */}
          <div className="flex overflow-x-auto border-b border-slate-200">
            {TABS.map((tab) => {
              const count = tabCounts[tab.key] ?? null
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'border-[#003746] text-[#003746]'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[0.95rem] ${activeTab === tab.key ? 'text-[#003746]' : 'text-slate-400'}`}>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {count !== null && count > 0 && (
                    <span className={`rounded-full px-1.5 py-px text-[10px] font-bold leading-none ${
                      activeTab === tab.key ? 'bg-[#003746] text-white' : 'bg-slate-100 text-slate-500'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Content: 12-col grid */}
          <div className="mt-4 grid grid-cols-12 gap-4">

            {/* Main content */}
            <div className="col-span-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-8">
              {activeTab === 'juridica'      && <TabJuridica      hab={habilitacao} />}
              {activeTab === 'tecnica'       && <TabTecnica       hab={habilitacao} />}
              {activeTab === 'profissionais' && <TabProfissionais hab={habilitacao} />}
              {activeTab === 'parcelas'      && <TabParcelas      hab={habilitacao} />}
              {activeTab === 'atestados'     && <TabAtestados     hab={habilitacao} />}
              {activeTab === 'financeira'    && <TabFinanceira    hab={habilitacao} />}
              {activeTab === 'alertas'       && <TabAlertas       hab={habilitacao} />}
            </div>

            {/* Sidebar */}
            <div className="col-span-12 space-y-4 lg:col-span-4">

              {/* Resumo da IA */}
              {firstAlert && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[1rem] text-amber-500">lightbulb</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Resumo da IA</h3>
                  </div>
                  {criticalAlerts[0] && (
                    <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-red-500">Ponto crítico</p>
                      <p className="text-xs leading-snug text-red-800">{criticalAlerts[0].descricao}</p>
                    </div>
                  )}
                  {atencaoAlerts[0] && !criticalAlerts[0] && (
                    <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-500">Atenção</p>
                      <p className="text-xs leading-snug text-amber-800">{atencaoAlerts[0].descricao}</p>
                    </div>
                  )}
                  {habilitacao.alertas.length > 1 && (
                    <button onClick={() => setActiveTab('alertas')}
                      className="text-xs font-medium text-[#003746] hover:underline">
                      Ver todos os {habilitacao.alertas.length} alertas →
                    </button>
                  )}
                </div>
              )}

              {/* Exportar Extração */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Exportar Extração</h3>
                <div className="space-y-2">
                  <button className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50">
                    <span className="material-symbols-outlined text-[1rem] text-slate-400">picture_as_pdf</span>
                    Relatório PDF
                  </button>
                  <button className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50">
                    <span className="material-symbols-outlined text-[1rem] text-slate-400">table_chart</span>
                    Planilha Excel
                  </button>
                  <button className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50">
                    <span className="material-symbols-outlined text-[1rem] text-red-400">gavel</span>
                    Gerar Impugnação
                  </button>
                </div>
              </div>

              {/* Dados adicionais */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Dados do Edital</h3>
                <dl className="space-y-2.5">
                  {([
                    { label: 'Regime',           value: edital.regimeExecucao },
                    { label: 'Prazo de Execução',value: edital.prazoExecucaoMeses ? `${edital.prazoExecucaoMeses} meses` : null },
                    { label: 'Admite Consórcio', value: edital.admiteConsorcio == null ? null : edital.admiteConsorcio ? 'Sim' : 'Não' },
                    { label: 'Arquivo',          value: edital.fileName },
                  ] as { label: string; value: string | null }[]).map((f) => f.value ? (
                    <div key={f.label}>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{f.label}</dt>
                      <dd className="mt-0.5 break-all text-xs text-slate-700">{f.value}</dd>
                    </div>
                  ) : null)}
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
