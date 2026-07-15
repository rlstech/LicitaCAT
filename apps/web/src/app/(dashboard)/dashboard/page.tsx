import { auth } from '@licitacat/auth'
import { headers } from 'next/headers'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface ReviewPendingEdital {
  id: string
  objeto: string | null
  orgaoLicitante: string | null
  modalidade: string | null
  dataAbertura: string | null
  updatedAt: string
  avgConfidence: string
}

interface DashboardStats {
  editais: {
    total: number
    prontos: number
    processando: number
    aguardandoRevisao: number
    byStatus: Record<string, number>
  }
  cats: { total: number }
  crossings: { totalThisMonth: number; avgScore: number | null }
  costs: { totalOcrCost: string; totalAiCost: string }
  reviewPendingEditais: ReviewPendingEdital[]
  upcomingEditais: Array<{
    id: string
    numeroEdital: string | null
    objeto: string | null
    valorEstimado: string | null
    dataAbertura: string | null
  }>
  recentJobs: Array<{
    id: string
    jobType: string
    entityType: string | null
    entityId: string | null
    status: string
    errorMessage: string | null
    createdAt: string
    completedAt: string | null
    entityName: string | null
  }>
}

const MODALIDADE_LABEL: Record<string, string> = {
  pregao_eletronico: 'Pregão Eletrônico',
  pregao_presencial: 'Pregão Presencial',
  concorrencia: 'Concorrência',
  tomada_de_precos: 'Tom. Preços',
  convite: 'Convite',
  leilao: 'Leilão',
  concurso: 'Concurso',
  rdc: 'RDC',
  credenciamento: 'Credenciamento',
  outro: 'Edital',
}

function getUrgency(dataAbertura: string | null): 'Alta' | 'Média' | 'Baixa' {
  if (!dataAbertura) return 'Baixa'
  const days = (new Date(dataAbertura).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (days <= 7) return 'Alta'
  if (days <= 30) return 'Média'
  return 'Baixa'
}

function relativeTime(date: string): string {
  const hours = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60))
  if (hours < 1) return 'Extraído há menos de 1h'
  if (hours < 24) return `Extraído há ${hours}h`
  return `Extraído há ${Math.floor(hours / 24)}d`
}

const MONTHS_PT = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

function formatAbertura(dataAbertura: string | null): { month: string; day: string; time: string } {
  if (!dataAbertura) return { month: '—', day: '—', time: '—' }
  const d = new Date(dataAbertura)
  return {
    month: MONTHS_PT[d.getMonth()] ?? '—',
    day: String(d.getDate()).padStart(2, '0'),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  }
}

function formatValueShort(valor: string | null): string {
  if (!valor) return '—'
  const n = Number(valor)
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}K`
  return `R$ ${n.toLocaleString('pt-BR')}`
}

const JOB_TITLE: Record<string, Record<string, string>> = {
  ocr:               { completed: 'OCR concluído',            running: 'OCR em andamento',        failed: 'Erro no OCR',            queued: 'OCR na fila',            retrying: 'Reprocessando OCR' },
  edital_extraction: { completed: 'Extração concluída',       running: 'Extração em andamento',   failed: 'Erro na extração',       queued: 'Extração na fila',       retrying: 'Reprocessando extração' },
  cat_extraction:    { completed: 'CAT processada',           running: 'Processando CAT',         failed: 'Erro na CAT',            queued: 'CAT na fila',            retrying: 'Reprocessando CAT' },
  crossing:          { completed: 'Cruzamento concluído',     running: 'Cruzamento em andamento', failed: 'Erro no cruzamento',     queued: 'Cruzamento na fila',     retrying: 'Reprocessando cruzamento' },
  embedding_gen:     { completed: 'Embeddings gerados',       running: 'Gerando embeddings',      failed: 'Erro nos embeddings',    queued: 'Embeddings na fila',     retrying: 'Reprocessando embeddings' },
}

function jobTitle(jobType: string, status: string): string {
  return JOB_TITLE[jobType]?.[status] ?? JOB_TITLE[jobType]?.['queued'] ?? jobType
}

function jobColor(status: string): string {
  if (status === 'completed') return 'bg-emerald-500'
  if (status === 'running')   return 'bg-blue-500'
  if (status === 'failed')    return 'bg-red-500'
  return 'bg-amber-500'
}

function jobIcon(jobType: string, status: string): string {
  if (status === 'failed') return 'error'
  if (jobType === 'crossing') return 'layers'
  if (jobType === 'cat_extraction') return 'upload_file'
  if (jobType === 'ocr') return 'document_scanner'
  if (status === 'completed') return 'check_circle'
  return 'sync'
}

async function fetchStats(token: string | null): Promise<DashboardStats | null> {
  if (!token) return null
  try {
    const res = await fetch(`${API_URL}/api/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json() as Promise<DashboardStats>
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: headers() as unknown as Headers })
  const token = session?.session.token ?? null
  const stats = await fetchStats(token)

  const avgScore = stats?.crossings.avgScore ?? 0

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">Visão geral do acervo e atividades</p>
      </div>

      {/* ── Bento Stats Grid ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Editais em Análise */}
        <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--border-soft)' }}>
          <div className="flex items-center justify-between">
            <span className="material-symbols-outlined text-[22px] text-brand-600">description</span>
            {stats && stats.editais.processando > 0 && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                +{stats.editais.processando} processando
              </span>
            )}
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {stats ? stats.editais.total : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Editais em Análise</p>
        </div>

        {/* CATs Cadastradas */}
        <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--border-soft)' }}>
          <div className="flex items-center justify-between">
            <span
              className="material-symbols-outlined text-[22px] text-brand-600"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              Total acumulado
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {stats ? stats.cats.total : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">CATs Cadastradas</p>
        </div>

        {/* Cruzamentos Realizados */}
        <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--border-soft)' }}>
          <div className="flex items-center justify-between">
            <span className="material-symbols-outlined text-[22px] text-brand-600">layers</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Este mês
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {stats ? stats.crossings.totalThisMonth : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Cruzamentos Realizados</p>
        </div>

        {/* Média de Aderência — card destacado */}
        <div className="relative flex flex-col overflow-hidden rounded-2xl bg-brand-600 p-5 text-white shadow-sm">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
          <div className="flex items-center justify-between relative">
            <span className="material-symbols-outlined text-[22px] text-white/80">analytics</span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight relative">
            {avgScore}%
          </p>
          <p className="mt-1 text-xs text-white/70 relative">Média de Aderência</p>
        </div>
      </div>

      {/* ── Grid Principal (2/3 + 1/3) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Coluna esquerda (2/3) */}
        <div className="space-y-6 lg:col-span-2">

          {/* Editais Prontos para Revisão */}
          <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--border-soft)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-brand-600">fact_check</span>
                <h2 className="text-sm font-semibold text-slate-900">Editais Prontos para Revisão</h2>
              </div>
              <Link href="/editais" className="text-xs font-medium text-brand-600 hover:underline">
                Ver todos
              </Link>
            </div>

            {stats && stats.reviewPendingEditais && stats.reviewPendingEditais.length > 0 ? (
              <div className="space-y-3">
                {stats.reviewPendingEditais.map((e) => (
                  <ReviewItem
                    key={e.id}
                    href={`/editais/${e.id}`}
                    category={MODALIDADE_LABEL[e.modalidade ?? ''] ?? 'Edital'}
                    title={e.objeto ?? e.orgaoLicitante ?? 'Edital sem descrição'}
                    date={relativeTime(e.updatedAt)}
                    score={Number(e.avgConfidence)}
                    urgency={getUrgency(e.dataAbertura)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <span className="material-symbols-outlined text-[32px] text-slate-300">task_alt</span>
                <p className="mt-2 text-sm text-slate-400">Nenhum edital pendente de revisão</p>
              </div>
            )}
          </div>

          {/* Atividades Recentes */}
          <div className="rounded-2xl bg-[#f8fcff] p-5" style={{ border: '1px solid var(--border-soft)' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[20px] text-brand-600">history</span>
              <h2 className="text-sm font-semibold text-slate-900">Atividades Recentes</h2>
            </div>

            {stats?.recentJobs && stats.recentJobs.length > 0 ? (
              <div className="space-y-4">
                {stats.recentJobs.slice(0, 5).map((job) => (
                  <ActivityItem
                    key={job.id}
                    color={jobColor(job.status)}
                    icon={jobIcon(job.jobType, job.status)}
                    title={jobTitle(job.jobType, job.status)}
                    description={
                      job.status === 'failed' && job.errorMessage
                        ? job.errorMessage.slice(0, 80)
                        : (job.entityName ?? '—')
                    }
                    time={relativeTime(job.completedAt ?? job.createdAt)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <span className="material-symbols-outlined text-[28px] text-slate-300">history_toggle_off</span>
                <p className="mt-2 text-sm text-slate-400">Nenhuma atividade recente</p>
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita (1/3) */}
        <div className="space-y-6">

          {/* Próximas Aberturas */}
          <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--border-soft)' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[20px] text-brand-600">calendar_month</span>
              <h2 className="text-sm font-semibold text-slate-900">Próximas Aberturas</h2>
            </div>

            {stats?.upcomingEditais && stats.upcomingEditais.length > 0 ? (
              <div className="space-y-3">
                {stats.upcomingEditais.map((e) => {
                  const { month, day, time } = formatAbertura(e.dataAbertura)
                  return (
                    <Link key={e.id} href={`/editais/${e.id}`} className="block">
                      <CalendarItem
                        month={month}
                        day={day}
                        title={e.objeto ?? e.numeroEdital ?? 'Edital sem descrição'}
                        time={time}
                        value={formatValueShort(e.valorEstimado)}
                      />
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <span className="material-symbols-outlined text-[28px] text-slate-300">event_busy</span>
                <p className="mt-2 text-sm text-slate-400">Nenhuma abertura nos próximos 14 dias</p>
              </div>
            )}

            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
              <Link href="/editais" className="text-xs font-medium text-brand-600 hover:underline">
                Ver calendário completo
              </Link>
            </div>
          </div>

          {/* Dica de acervo */}
          <div className="rounded-2xl p-5" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-low, #e6f6ff)' }}>
            <div className="flex items-center gap-2 text-[#003746]">
              <span className="material-symbols-outlined text-[20px]">psychology</span>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Dica</p>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-800 leading-snug">
              Amplie CATs em edificações para aumentar a elegibilidade em editais do segmento.
            </p>
            <Link
              href="/cruzamentos"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#003746] hover:underline"
            >
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              Ver cruzamentos
            </Link>
          </div>

          {/* Mapa placeholder */}
          <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfe6f2] bg-[#f3faff] text-center">
            <span className="material-symbols-outlined text-[28px] text-slate-300">map</span>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Mapa de Obras</p>
            <p className="mt-0.5 text-[10px] text-slate-300">Em breve</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────

function ReviewItem({
  href, category, title, date, score, urgency,
}: {
  href: string
  category: string
  title: string
  date: string
  score: number
  urgency: 'Alta' | 'Média' | 'Baixa'
}) {
  const urgencyStyles = {
    Alta: 'bg-red-50 text-red-700',
    Média: 'bg-amber-50 text-amber-700',
    Baixa: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
      style={{ border: '1px solid var(--border-soft)' }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">
            {category}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${urgencyStyles[urgency]}`}>
            {urgency}
          </span>
        </div>
        <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{date}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold text-brand-600">{score}%</span>
        <span className="material-symbols-outlined text-[18px] text-slate-300">chevron_right</span>
      </div>
    </Link>
  )
}

function ActivityItem({
  color, icon, title, description, time,
}: {
  color: string
  icon: string
  title: string
  description: string
  time: string
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${color}`}>
          <span className="material-symbols-outlined text-[16px] text-white">{icon}</span>
        </div>
        <div className="mt-1 h-full w-px bg-slate-200" />
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        <p className="text-[11px] text-slate-400 mt-1">{time}</p>
      </div>
    </div>
  )
}

function CalendarItem({
  month, day, title, time, value,
}: {
  month: string
  day: string
  title: string
  time: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50">
        <span className="text-[10px] font-bold uppercase text-brand-600 leading-none">{month}</span>
        <span className="text-lg font-bold text-brand-600 leading-none mt-0.5">{day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-400">{time}</span>
          <span className="text-[11px] font-semibold text-slate-600">{value}</span>
        </div>
      </div>
    </div>
  )
}
