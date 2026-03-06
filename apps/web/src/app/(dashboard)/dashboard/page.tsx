import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

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
  recentJobs: Array<{
    id: string
    jobType: string
    entityType: string
    status: string
    createdAt: string
    completedAt: string | null
    errorMessage: string | null
    costUsd: string | null
  }>
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

const JOB_TYPE_LABELS: Record<string, string> = {
  ocr: 'OCR',
  edital_extraction: 'Extração de Edital',
  cat_extraction: 'Extração de CAT',
  crossing: 'Cruzamento',
  embedding_gen: 'Geração de Embeddings',
}

const JOB_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  queued: { label: 'Aguardando', color: 'bg-gray-100 text-gray-700' },
  running: { label: 'Executando', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-700' },
  retrying: { label: 'Tentando', color: 'bg-yellow-100 text-yellow-700' },
}

export default async function DashboardPage() {
  const { getToken } = auth()
  const token = await getToken()
  const stats = await fetchStats(token)

  const totalCost =
    stats
      ? (parseFloat(stats.costs.totalOcrCost) + parseFloat(stats.costs.totalAiCost)).toFixed(4)
      : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Visão geral do acervo e atividades recentes.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Editais prontos"
          value={stats ? String(stats.editais.prontos) : '—'}
          description={`${stats?.editais.total ?? 0} total • ${stats?.editais.processando ?? 0} processando`}
          href="/editais"
          icon={
            <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
        />

        <StatCard
          title="CATs no acervo"
          value={stats ? String(stats.cats.total) : '—'}
          description="CATs ativas cadastradas"
          href="/cats"
          icon={
            <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          }
        />

        <StatCard
          title="Cruzamentos (mês)"
          value={stats ? String(stats.crossings.totalThisMonth) : '—'}
          description={
            stats?.crossings.avgScore != null
              ? `Score médio: ${stats.crossings.avgScore}`
              : 'Nenhum cruzamento concluído'
          }
          href="/cruzamentos"
          icon={
            <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          }
        />

        <StatCard
          title="Custo total IA"
          value={totalCost ? `$${totalCost}` : '—'}
          description="OCR + extração + cruzamentos"
          href="/editais"
          icon={
            <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          }
        />
      </div>

      {/* Awaiting Review Alert */}
      {stats && stats.editais.aguardandoRevisao > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <svg className="h-5 w-5 shrink-0 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">{stats.editais.aguardandoRevisao} edital(is)</span> aguardando revisão de requisitos antes do cruzamento.{' '}
            <Link href="/editais" className="underline hover:text-yellow-900">Revisar agora →</Link>
          </p>
        </div>
      )}

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Atividade recente</h2>

        {!stats || stats.recentJobs.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              Nenhuma atividade recente. Comece fazendo o{' '}
              <Link href="/editais/upload" className="text-brand-600 hover:underline">upload de um edital</Link>.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Entidade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Custo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.recentJobs.map((job) => {
                  const statusCfg = JOB_STATUS_CONFIG[job.status] ?? { label: job.status, color: 'bg-gray-100 text-gray-700' }
                  return (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 capitalize">{job.entityType}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        {job.errorMessage && (
                          <p className="mt-0.5 text-xs text-red-600 truncate max-w-xs" title={job.errorMessage}>
                            {job.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {job.costUsd ? `$${parseFloat(job.costUsd).toFixed(4)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(job.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Ações rápidas</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickActionCard
            href="/editais/upload"
            title="Novo edital"
            description="Faça upload de um edital para extração de requisitos"
            icon="📄"
          />
          <QuickActionCard
            href="/cats/upload"
            title="Nova CAT"
            description="Adicione uma CAT ao acervo técnico da empresa"
            icon="📋"
          />
          <QuickActionCard
            href="/cruzamentos"
            title="Ver cruzamentos"
            description="Analise a aderência de editais ao seu acervo"
            icon="🔀"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  href,
  icon,
}: {
  title: string
  value: string
  description: string
  href: string
  icon: React.ReactNode
}) {
  return (
    <Link href={href} className="block rounded-lg border bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </Link>
  )
}

function QuickActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string
  title: string
  description: string
  icon: string
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 rounded-lg border bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
    </Link>
  )
}
