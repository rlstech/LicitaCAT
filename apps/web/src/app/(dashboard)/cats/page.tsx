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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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

  async function handleDelete(catId: string) {
    setDeletingId(catId)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/cats/${catId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok || res.status === 204) {
        setCats((prev) => prev.filter((c) => c.id !== catId))
        setTotal((t) => t - 1)
      }
    } catch { /* silent */ } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const confirmCat = cats.find((c) => c.id === confirmDeleteId)

  return (
    <div>
      {/* Modal de confirmação */}
      {confirmDeleteId && confirmCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Excluir CAT</h3>
            <p className="mt-2 text-sm text-gray-600">
              Tem certeza que deseja excluir a CAT <span className="font-medium">{confirmCat.numeroCat ?? confirmCat.fileName}</span>?
              Esta ação é irreversível e removerá todos os itens associados.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deletingId === confirmDeleteId}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === confirmDeleteId && (
                  <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                )}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/cats/${cat.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                          Ver detalhes
                        </Link>
                        <button
                          onClick={() => setConfirmDeleteId(cat.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Excluir CAT"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
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
