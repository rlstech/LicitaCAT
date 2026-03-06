'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Cat {
    id: string
    fileName: string
    numeroCat: string | null
    empresaContratante: string | null
    tipoObraServico: string | null
    descricaoTecnica: string | null
    quantitativoValor: string | null
    quantitativoUnidade: string | null
    dataInicio: string | null
    dataConclusao: string | null
    statusExtracao: string
    aiConfidenceScore: number | null
    profissional?: { nome: string; numeroCreaCau: string; conselho: string }
    createdAt: string
}

interface CatItem {
    id: string
    numeroItem: number | null
    descricao: string
    unidade: string | null
    quantidade: string | null
    origem: string
    aiConfidenceScore: number | null
    ordem: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendente', color: 'bg-gray-100 text-gray-700' },
    processing: { label: 'Processando', color: 'bg-yellow-100 text-yellow-800' },
    review_pending: { label: 'Aguardando revisão', color: 'bg-orange-100 text-orange-800' },
    completed: { label: 'Completa', color: 'bg-green-100 text-green-700' },
    error: { label: 'Erro', color: 'bg-red-100 text-red-700' },
}

export default function CatDetailPage() {
    const { getToken, isLoaded } = useAuth()
    const params = useParams()
    const catId = params.id as string

    const [cat, setCat] = useState<Cat | null>(null)
    const [itens, setItens] = useState<CatItem[]>([])
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        try {
            const token = await getToken()
            const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }

            const [catRes, itensRes] = await Promise.all([
                fetch(`${API_URL}/api/cats/${catId}`, { headers }),
                fetch(`${API_URL}/api/cats/${catId}/itens`, { headers }),
            ])

            if (catRes.ok) setCat(await catRes.json() as Cat)
            if (itensRes.ok) setItens(await itensRes.json() as CatItem[])
        } catch { /* silent */ } finally { setLoading(false) }
    }, [getToken, catId])

    useEffect(() => {
        if (!isLoaded) return
        fetchData()
        const interval = setInterval(() => {
            if (!cat || cat.statusExtracao === 'processing') fetchData()
        }, 5000)
        return () => clearInterval(interval)
    }, [fetchData, isLoaded, cat?.statusExtracao])

    async function deleteItem(itemId: string) {
        const token = await getToken()
        await fetch(`${API_URL}/api/cats/${catId}/itens/${itemId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        })
        setItens((prev) => prev.filter((i) => i.id !== itemId))
    }

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-brand-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
    )

    if (!cat) return (
        <div className="text-center py-20">
            <p className="text-gray-500">CAT não encontrada.</p>
            <Link href="/cats" className="mt-4 text-brand-600 hover:text-brand-700">← Voltar</Link>
        </div>
    )

    const statusInfo = STATUS_CONFIG[cat.statusExtracao] ?? { label: cat.statusExtracao, color: 'bg-gray-100 text-gray-700' }

    return (
        <div>
            {/* Header */}
            <div className="mb-6">
                <Link href="/cats" className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
                    <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    Voltar para CATs
                </Link>

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{cat.numeroCat ?? cat.fileName}</h1>
                        {cat.numeroCat && <p className="mt-1 text-sm text-gray-500">{cat.fileName}</p>}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusInfo.color}`}>
                        {cat.statusExtracao === 'processing' && (
                            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        )}
                        {statusInfo.label}
                    </span>
                </div>
            </div>

            {/* Metadata Cards */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <MetaCard label="Profissional" value={cat.profissional ? `${cat.profissional.nome}` : null} />
                <MetaCard label="Contratante" value={cat.empresaContratante} />
                <MetaCard label="Tipo" value={cat.tipoObraServico} />
                <MetaCard label="Período" value={
                    cat.dataInicio && cat.dataConclusao
                        ? `${new Date(cat.dataInicio).toLocaleDateString('pt-BR')} — ${new Date(cat.dataConclusao).toLocaleDateString('pt-BR')}`
                        : cat.dataInicio ? `Início: ${new Date(cat.dataInicio).toLocaleDateString('pt-BR')}` : null
                } />
                <MetaCard label="Quantitativo" value={cat.quantitativoValor ? `${cat.quantitativoValor} ${cat.quantitativoUnidade ?? ''}` : null} />
            </div>

            {/* Descrição Técnica */}
            {cat.descricaoTecnica && (
                <div className="mb-8 rounded-lg border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500">Descrição Técnica</h3>
                    <p className="mt-1 text-sm text-gray-900">{cat.descricaoTecnica}</p>
                </div>
            )}

            {/* Processing */}
            {cat.statusExtracao === 'processing' && (
                <div className="mb-8 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <svg className="h-5 w-5 animate-spin text-blue-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    <p className="text-sm text-blue-800">Extraindo dados da CAT por IA...</p>
                </div>
            )}

            {/* Itens */}
            <div>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Itens do Acervo ({itens.length})</h2>

                {itens.length === 0 && cat.statusExtracao !== 'processing' ? (
                    <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
                        <p className="text-sm text-gray-500">Nenhum item extraído.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">#</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Descrição</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Qtd</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Unidade</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Origem</th>
                                    <th className="relative px-4 py-3"><span className="sr-only">Ações</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {itens.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{item.numeroItem ?? item.ordem + 1}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900">{item.descricao}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{item.quantidade ?? '—'}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{item.unidade ?? '—'}</td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.origem === 'ai_extracted' ? 'bg-purple-100 text-purple-700'
                                                    : item.origem === 'human_added' ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-teal-100 text-teal-700'
                                                }`}>
                                                {item.origem === 'ai_extracted' ? 'IA' : item.origem === 'human_added' ? 'Manual' : 'Excel'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            <button onClick={() => deleteItem(item.id)} className="text-xs text-red-600 hover:text-red-800">Remover</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Confidence Score */}
            {cat.aiConfidenceScore !== null && (
                <div className="mt-6 rounded-lg border bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Score de confiança da IA: {cat.aiConfidenceScore}%</p>
                </div>
            )}
        </div>
    )
}

function MetaCard({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 truncate">{value ?? '—'}</p>
        </div>
    )
}
