'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Cat {
  id: string
  fileName: string
  numeroCat: string | null
  empresaContratante: string | null
  tipoObraServico: string | null
  statusExtracao: string
  profissionalId: string
  createdAt: string
}

interface CatsResponse {
  data: Cat[]
  total: number
  page: number
  limit: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-gray-100 text-gray-700' },
  processing: { label: 'Processando', color: 'bg-yellow-100 text-yellow-800' },
  review_pending: { label: 'Aguardando revisão', color: 'bg-orange-100 text-orange-800' },
  completed: { label: 'Completa', color: 'bg-green-100 text-green-700' },
  error: { label: 'Erro', color: 'bg-red-100 text-red-700' },
}

export default function CatsPage() {
  const { getToken } = useAuth()
  const [cats, setCats] = useState<Cat[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const fetchCats = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/cats?page=${page}&limit=20`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) {
        const data = (await res.json()) as CatsResponse
        setCats(data.data)
        setTotal(data.total)
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getToken, page])

  useEffect(() => {
    fetchCats()
    const interval = setInterval(fetchCats, 10000)
    return () => clearInterval(interval)
  }, [fetchCats])

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CATs — Acervo Técnico</h1>
          <p className="mt-1 text-gray-600">Certidões de Acervo Técnico da empresa</p>
        </div>
        <div className="flex gap-2">
          <Link href="/cats/profissionais" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Profissionais
          </Link>
          <Link href="/cats/upload" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
            + Nova CAT
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">CAT</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Contratante</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Obra/Serviço</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Data</th>
                <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Carregando...
                    </div>
                  </td>
                </tr>
              ) : cats.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">Nenhuma CAT cadastrada.</td></tr>
              ) : cats.map((cat) => {
                const statusInfo = STATUS_CONFIG[cat.statusExtracao] ?? { label: cat.statusExtracao, color: 'bg-gray-100 text-gray-700' }
                return (
                  <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{cat.numeroCat ?? cat.fileName}</div>
                      {cat.numeroCat && <div className="text-xs text-gray-500">{cat.fileName}</div>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{cat.empresaContratante ?? '—'}</td>
                    <td className="max-w-[200px] truncate px-6 py-4 text-sm text-gray-700">{cat.tipoObraServico ?? '—'}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                        {cat.statusExtracao === 'processing' && (
                          <svg className="mr-1.5 h-3 w-3 animate-spin" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(cat.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <Link href={`/cats/${cat.id}`} className="font-medium text-brand-600 hover:text-brand-700">Ver detalhes</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {total > 20 && (
            <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-3">
              <p className="text-sm text-gray-600">Mostrando {(page - 1) * 20 + 1} a {Math.min(page * 20, total)} de {total}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-100">Anterior</button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-100">Próxima</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
