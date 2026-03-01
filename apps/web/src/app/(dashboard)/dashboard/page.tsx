import { auth } from '@clerk/nextjs/server'

export default function DashboardPage() {
  const { userId } = auth()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-gray-600">
        Bem-vindo ao LicitaCAT. Gerencie seus editais e acervo de CATs.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Editais ativos" value="—" description="em processamento ou prontos" />
        <StatCard title="CATs cadastradas" value="—" description="no acervo técnico" />
        <StatCard title="Cruzamentos" value="—" description="realizados este mês" />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Atividade recente</h2>
        <p className="mt-4 text-sm text-gray-500">
          Nenhuma atividade recente. Comece fazendo o upload de um edital.
        </p>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}
