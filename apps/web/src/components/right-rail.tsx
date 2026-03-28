import Link from 'next/link'
import { JOB_TYPE_LABELS, JOB_STATUS_CONFIG } from '@/lib/job-status'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface RailData {
  editais: {
    aguardandoRevisao: number
    processando: number
  }
  crossings: {
    totalThisMonth: number
    avgScore: number | null
  }
  recentJobs: Array<{
    id: string
    jobType: string
    status: string
    createdAt: string
    costUsd: string | null
  }>
  crossingsPendingReview: number
  upcomingEditais: Array<{
    id: string
    numeroEdital: string | null
    fileName: string
    dataAbertura: string | null
  }>
}

async function fetchRailData(token: string | null): Promise<RailData | null> {
  if (!token) return null
  try {
    const res = await fetch(`${API_URL}/api/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 30 },
    })
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function deadlineColor(days: number): string {
  if (days <= 3) return 'text-red-600 bg-red-50'
  if (days <= 7) return 'text-amber-700 bg-amber-50'
  return 'text-slate-600 bg-slate-100'
}

function deadlineDot(days: number): string {
  if (days <= 3) return 'bg-red-500'
  if (days <= 7) return 'bg-amber-400'
  return 'bg-slate-300'
}

export async function RightRail({ token }: { token: string | null }) {
  const data = await fetchRailData(token)

  const pendingEditais = data?.editais.aguardandoRevisao ?? 0
  const pendingCrossings = data?.crossingsPendingReview ?? 0
  const hasPending = pendingEditais > 0 || pendingCrossings > 0

  return (
    <aside
      className="hidden xl:flex w-[252px] shrink-0 flex-col scrollbar-thin overflow-y-auto"
      style={{
        backgroundColor: 'var(--canvas)',
        borderLeft: '1px solid var(--border)',
      }}
    >

      {/* ── Ação Principal ── */}
      <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <Link
          href="/editais/upload"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 active:bg-brand-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Novo Edital
        </Link>
        <Link
          href="/cats/upload"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
          style={{ borderColor: 'var(--border)' }}
        >
          Nova CAT
        </Link>
      </div>

      {/* ── Pendências ── */}
      <div className="p-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <RailSection label="Pendências" />
        {hasPending ? (
          <div className="space-y-2">
            {pendingEditais > 0 && (
              <Link
                href="/editais"
                className="flex items-center justify-between rounded-lg border-l-[3px] border-amber-400 bg-amber-50 px-3 py-2.5 transition-colors hover:bg-amber-100"
              >
                <span className="text-xs font-medium text-amber-900">Editais p/ revisão</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-white">
                  {pendingEditais}
                </span>
              </Link>
            )}
            {pendingCrossings > 0 && (
              <Link
                href="/cruzamentos"
                className="flex items-center justify-between rounded-lg border-l-[3px] border-amber-400 bg-amber-50 px-3 py-2.5 transition-colors hover:bg-amber-100"
              >
                <span className="text-xs font-medium text-amber-900">Cruzamentos p/ revisão</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-white">
                  {pendingCrossings}
                </span>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
            <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-xs font-medium text-emerald-700">Tudo em dia</span>
          </div>
        )}
      </div>

      {/* ── Próximos Prazos ── */}
      {data && data.upcomingEditais.length > 0 && (
        <div className="p-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <RailSection label="Próximos prazos" />
          <div className="space-y-1.5">
            {data.upcomingEditais.map((edital) => {
              const days = edital.dataAbertura ? daysUntil(edital.dataAbertura) : null
              const date = edital.dataAbertura
                ? new Date(edital.dataAbertura).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                : '—'
              const label = edital.numeroEdital ?? edital.fileName

              return (
                <Link
                  key={edital.id}
                  href={`/editais/${edital.id}`}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-white"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${days !== null ? deadlineDot(days) : 'bg-slate-300'}`} />
                  <span className="shrink-0 tabular-nums text-xs text-slate-500">{date}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{label}</span>
                  {days !== null && days <= 7 && (
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${deadlineColor(days)}`}>
                      {days}d
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Atividade Recente ── */}
      <div className="p-4">
        <RailSection label="Atividade recente" />
        {!data || data.recentJobs.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhuma atividade ainda.</p>
        ) : (
          <div className="space-y-2">
            {data.recentJobs.slice(0, 6).map((job) => {
              const s = JOB_STATUS_CONFIG[job.status] ?? { label: job.status, dot: 'bg-slate-400', text: 'text-slate-500' }
              return (
                <div key={job.id} className="flex items-center gap-2.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                    {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                  </span>
                  <span className="shrink-0 tabular-nums text-[11px] text-slate-400">
                    {relativeTime(job.createdAt)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </aside>
  )
}

function RailSection({ label }: { label: string }) {
  return (
    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
      {label}
    </p>
  )
}
