'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

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
  processingTimeSeconds: number | null
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  queued: { label: 'Na fila', color: 'bg-gray-100 text-gray-700' },
  processing: { label: 'Processando', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
  error: { label: 'Erro', color: 'bg-red-100 text-red-700' },
}

const REC_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  participar: { label: 'Participar', color: 'bg-green-100 text-green-800', icon: '✅' },
  participar_com_ressalvas: { label: 'Com Ressalvas', color: 'bg-yellow-100 text-yellow-800', icon: '⚠️' },
  nao_participar: { label: 'Não Participar', color: 'bg-red-100 text-red-800', icon: '❌' },
}

export default function CruzamentosPage() {
  const { getToken } = useAuth()
  const [crossings, setCrossings] = useState<Crossing[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCrossings = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/crossings`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) setCrossings(await res.json() as Crossing[])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getToken])

  useEffect(() => {
    fetchCrossings()
    const interval = setInterval(fetchCrossings, 10000)
    return () => clearInterval(interval)
  }, [fetchCrossings])

  function getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-700'
    if (score >= 50) return 'text-yellow-700'
    return 'text-red-700'
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cruzamentos</h1>
        <p className="mt-1 text-gray-600">Análise de aderência das CATs aos requisitos dos editais</p>
      </div>

      <div className="mt-8 space-y-4">
        {loading ? (
          <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <svg className="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Carregando...
            </div>
          </div>
        ) : crossings.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">Nenhum cruzamento realizado. Acesse um edital e inicie a análise.</p>
          </div>
        ) : crossings.map((c) => {
          const statusInfo = STATUS_CONFIG[c.status] ?? { label: c.status, color: 'bg-gray-100 text-gray-700' }
          const recInfo = c.recomendacao ? REC_CONFIG[c.recomendacao] : null

          return (
            <Link key={c.id} href={`/cruzamentos/${c.id}`} className="block rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Score */}
                  {c.scoreAderencia !== null ? (
                    <div className={`text-center ${getScoreColor(c.scoreAderencia)}`}>
                      <div className="text-3xl font-bold">{c.scoreAderencia}</div>
                      <div className="text-xs font-medium">/ 100</div>
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center">
                      <svg className="h-8 w-8 animate-spin text-gray-300" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                      {recInfo && (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${recInfo.color}`}>{recInfo.icon} {recInfo.label}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {c.processingTimeSeconds ? ` · ${c.processingTimeSeconds}s` : ''}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                {c.totalRequisitos !== null && (
                  <div className="hidden sm:flex gap-4 text-center text-xs">
                    <div><div className="text-lg font-bold text-green-700">{c.requisitosAtendidos}</div><div className="text-gray-500">Atendidos</div></div>
                    <div><div className="text-lg font-bold text-yellow-700">{c.requisitosComRessalva}</div><div className="text-gray-500">Parciais</div></div>
                    <div><div className="text-lg font-bold text-red-700">{c.requisitosGap}</div><div className="text-gray-500">Gaps</div></div>
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
