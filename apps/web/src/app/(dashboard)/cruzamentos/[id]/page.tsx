'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import Link from 'next/link'

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
    recomendacaoJustificativa: string | null
    aiCostUsd: string | null
    processingTimeSeconds: number | null
    createdAt: string
}

interface CrossingItem {
    id: string
    requisitoId: string
    resultado: string
    aiJustificativa: string | null
    scoreSimilaridadeMax: string | null
    humanOverride: boolean
    humanOverrideNote: string | null
}

const RESULT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    atendido: { label: 'Atendido', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    atendido_parcialmente: { label: 'Parcial', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
    gap: { label: 'Gap', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
}

const REC_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    participar: { label: 'Participar', color: 'bg-green-600', icon: '✅' },
    participar_com_ressalvas: { label: 'Participar com Ressalvas', color: 'bg-yellow-600', icon: '⚠️' },
    nao_participar: { label: 'Não Participar', color: 'bg-red-600', icon: '❌' },
}

export default function CruzamentoDetailPage() {
    const { getToken } = useAuth()
    const params = useParams()
    const crossingId = params.id as string

    const [crossing, setCrossing] = useState<Crossing | null>(null)
    const [items, setItems] = useState<CrossingItem[]>([])
    const [loading, setLoading] = useState(true)
    const [overriding, setOverriding] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        try {
            const token = await getToken()
            const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }

            const [cRes, iRes] = await Promise.all([
                fetch(`${API_URL}/api/crossings/${crossingId}`, { headers }),
                fetch(`${API_URL}/api/crossings/${crossingId}/items`, { headers }),
            ])

            if (cRes.ok) setCrossing(await cRes.json() as Crossing)
            if (iRes.ok) setItems(await iRes.json() as CrossingItem[])
        } catch { /* silent */ } finally { setLoading(false) }
    }, [getToken, crossingId])

    useEffect(() => {
        fetchData()
        const interval = setInterval(() => {
            if (crossing && crossing.status === 'processing') fetchData()
        }, 5000)
        return () => clearInterval(interval)
    }, [fetchData, crossing?.status])

    async function overrideItem(itemId: string, resultado: string) {
        setOverriding(itemId)
        try {
            const token = await getToken()
            await fetch(`${API_URL}/api/crossings/${crossingId}/items/${itemId}/override`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ resultado }),
            })
            setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, resultado, humanOverride: true } : i))
        } catch { /* silent */ } finally { setOverriding(null) }
    }

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-brand-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
    )

    if (!crossing) return (
        <div className="text-center py-20">
            <p className="text-gray-500">Cruzamento não encontrado.</p>
            <Link href="/cruzamentos" className="mt-4 text-brand-600">← Voltar</Link>
        </div>
    )

    const recInfo = crossing.recomendacao ? REC_CONFIG[crossing.recomendacao] : null

    return (
        <div>
            <Link href="/cruzamentos" className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
                <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                Voltar
            </Link>

            {/* Recommendation Banner */}
            {recInfo && (
                <div className={`mb-6 rounded-xl ${recInfo.color} p-6 text-white shadow-lg`}>
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{recInfo.icon}</span>
                        <div>
                            <h2 className="text-xl font-bold">{recInfo.label}</h2>
                            {crossing.recomendacaoJustificativa && (
                                <p className="mt-1 text-sm opacity-90">{crossing.recomendacaoJustificativa}</p>
                            )}
                        </div>
                        {crossing.scoreAderencia !== null && (
                            <div className="ml-auto text-center">
                                <div className="text-4xl font-bold">{crossing.scoreAderencia}</div>
                                <div className="text-xs font-medium opacity-80">Score</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Processing */}
            {crossing.status === 'processing' && (
                <div className="mb-6 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <svg className="h-5 w-5 animate-spin text-blue-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8  0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    <p className="text-sm text-blue-800">Cruzamento em andamento. Atualizando automaticamente...</p>
                </div>
            )}

            {/* Stats Cards */}
            {crossing.totalRequisitos !== null && (
                <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
                    <StatCard label="Total" value={crossing.totalRequisitos ?? 0} color="text-gray-900" />
                    <StatCard label="Atendidos" value={crossing.requisitosAtendidos ?? 0} color="text-green-700" />
                    <StatCard label="Parciais" value={crossing.requisitosComRessalva ?? 0} color="text-yellow-700" />
                    <StatCard label="Gaps" value={crossing.requisitosGap ?? 0} color="text-red-700" />
                    <div className="rounded-lg border bg-white p-3 shadow-sm">
                        <p className="text-xs font-medium text-gray-500">Tempo</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{crossing.processingTimeSeconds ? `${crossing.processingTimeSeconds}s` : '—'}</p>
                    </div>
                </div>
            )}

            {/* Items */}
            <div>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Requisitos Analisados ({items.length})</h2>

                {items.length === 0 && crossing.status !== 'processing' ? (
                    <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
                        <p className="text-sm text-gray-500">Nenhum item de cruzamento.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => {
                            const resInfo = RESULT_CONFIG[item.resultado] ?? { label: item.resultado, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' }

                            return (
                                <div key={item.id} className={`rounded-lg border p-4 ${resInfo.bg} transition-all`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-sm font-bold ${resInfo.color}`}>{resInfo.label}</span>
                                                {item.humanOverride && (
                                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Revisado</span>
                                                )}
                                                {item.scoreSimilaridadeMax && (
                                                    <span className="text-xs text-gray-500">Sim: {(parseFloat(item.scoreSimilaridadeMax) * 100).toFixed(1)}%</span>
                                                )}
                                            </div>
                                            {item.aiJustificativa && (
                                                <p className="text-sm text-gray-700">{item.aiJustificativa}</p>
                                            )}
                                        </div>

                                        {/* Override Buttons */}
                                        {!item.humanOverride && (
                                            <div className="flex shrink-0 gap-1">
                                                <button onClick={() => overrideItem(item.id, 'atendido')} disabled={overriding === item.id} className="rounded border border-green-300 bg-white p-1 text-green-700 hover:bg-green-50 disabled:opacity-50 text-xs px-2" title="Atendido">✓</button>
                                                <button onClick={() => overrideItem(item.id, 'atendido_parcialmente')} disabled={overriding === item.id} className="rounded border border-yellow-300 bg-white p-1 text-yellow-700 hover:bg-yellow-50 disabled:opacity-50 text-xs px-2" title="Parcial">~</button>
                                                <button onClick={() => overrideItem(item.id, 'gap')} disabled={overriding === item.id} className="rounded border border-red-300 bg-white p-1 text-red-700 hover:bg-red-50 disabled:opacity-50 text-xs px-2" title="Gap">✗</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Cost */}
            {crossing.aiCostUsd && (
                <div className="mt-8 rounded-lg border bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Custo: ${crossing.aiCostUsd} USD</p>
                </div>
            )}
        </div>
    )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
        </div>
    )
}
