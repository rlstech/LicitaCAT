'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Edital {
    id: string
    fileName: string
    orgaoLicitante: string | null
    numeroEdital: string | null
    modalidade: string | null
    objeto: string | null
    valorEstimado: string | null
    dataAbertura: string | null
    status: string
    pageCount: number | null
    pdfType: string | null
    aiExtractionCostUsd: string | null
    ocrCostUsd: string | null
    createdAt: string
}

interface Requisito {
    id: string
    lote: string | null
    categoria: string
    descricao: string
    trechoOriginal: string | null
    paginaReferencia: number | null
    quantitativoExigido: string | null
    unidade: string | null
    aiConfidenceScore: number
    status: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    uploaded: { label: 'Enviado', color: 'bg-gray-100 text-gray-700' },
    ocr_processing: { label: 'OCR em andamento', color: 'bg-yellow-100 text-yellow-800' },
    extracting: { label: 'Extraindo requisitos', color: 'bg-blue-100 text-blue-800' },
    review_pending: { label: 'Aguardando revisão', color: 'bg-orange-100 text-orange-800' },
    ready: { label: 'Pronto', color: 'bg-green-100 text-green-700' },
    error: { label: 'Erro', color: 'bg-red-100 text-red-700' },
}

const REQUISITO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    ai_extracted: { label: 'Extraído pela IA', color: 'bg-purple-100 text-purple-700' },
    human_approved: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
    human_edited: { label: 'Editado', color: 'bg-blue-100 text-blue-700' },
    human_rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
}

const MODALIDADE_LABELS: Record<string, string> = {
    pregao_eletronico: 'Pregão Eletrônico',
    pregao_presencial: 'Pregão Presencial',
    concorrencia: 'Concorrência',
    tomada_de_precos: 'Tomada de Preços',
    convite: 'Convite',
    leilao: 'Leilão',
    concurso: 'Concurso',
    rdc: 'RDC',
    credenciamento: 'Credenciamento',
    outro: 'Outro',
}

export default function EditalDetailPage() {
    const { getToken } = useAuth()
    const params = useParams()
    const router = useRouter()
    const editalId = params.id as string

    const [edital, setEdital] = useState<Edital | null>(null)
    const [requisitos, setRequisitos] = useState<Requisito[]>([])
    const [loading, setLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        try {
            const token = await getToken()
            const headers = {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            }

            const [editalRes, reqRes] = await Promise.all([
                fetch(`${API_URL}/api/editais/${editalId}`, { headers }),
                fetch(`${API_URL}/api/editais/${editalId}/requisitos`, { headers }),
            ])

            if (editalRes.ok) {
                setEdital(await editalRes.json() as Edital)
            }
            if (reqRes.ok) {
                setRequisitos(await reqRes.json() as Requisito[])
            }
        } catch {
            // fail silently
        } finally {
            setLoading(false)
        }
    }, [getToken, editalId])

    useEffect(() => {
        fetchData()

        // Poll if still processing
        const interval = setInterval(() => {
            if (edital && ['ocr_processing', 'extracting'].includes(edital.status)) {
                fetchData()
            }
        }, 5000)
        return () => clearInterval(interval)
    }, [fetchData, edital?.status])

    async function updateRequisitoStatus(requisitoId: string, newStatus: string) {
        setUpdatingId(requisitoId)
        try {
            const token = await getToken()
            const res = await fetch(
                `${API_URL}/api/editais/${editalId}/requisitos/${requisitoId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ status: newStatus }),
                },
            )

            if (res.ok) {
                setRequisitos((prev) =>
                    prev.map((r) => (r.id === requisitoId ? { ...r, status: newStatus } : r)),
                )
            }
        } catch {
            // fail silently
        } finally {
            setUpdatingId(null)
        }
    }

    function getConfidenceColor(score: number): string {
        if (score >= 80) return 'text-green-700 bg-green-50'
        if (score >= 60) return 'text-yellow-700 bg-yellow-50'
        return 'text-red-700 bg-red-50'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <svg className="h-8 w-8 animate-spin text-brand-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            </div>
        )
    }

    if (!edital) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500">Edital não encontrado.</p>
                <Link href="/editais" className="mt-4 text-brand-600 hover:text-brand-700">
                    ← Voltar para editais
                </Link>
            </div>
        )
    }

    const statusInfo = STATUS_CONFIG[edital.status] ?? { label: edital.status, color: 'bg-gray-100 text-gray-700' }
    const isProcessing = ['ocr_processing', 'extracting'].includes(edital.status)
    const lowConfidenceCount = requisitos.filter((r) => r.aiConfidenceScore < 70 && r.status === 'ai_extracted').length

    return (
        <div>
            {/* Header */}
            <div className="mb-6">
                <Link href="/editais" className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
                    <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Voltar para editais
                </Link>

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {edital.numeroEdital ?? edital.fileName}
                        </h1>
                        {edital.numeroEdital && (
                            <p className="mt-1 text-sm text-gray-500">{edital.fileName}</p>
                        )}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusInfo.color}`}>
                        {isProcessing && (
                            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        )}
                        {statusInfo.label}
                    </span>
                </div>
            </div>

            {/* Metadata Cards */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <MetaCard label="Órgão" value={edital.orgaoLicitante} />
                <MetaCard label="Modalidade" value={edital.modalidade ? MODALIDADE_LABELS[edital.modalidade] ?? edital.modalidade : null} />
                <MetaCard label="Valor Estimado" value={edital.valorEstimado ? `R$ ${parseFloat(edital.valorEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                <MetaCard label="Data Abertura" value={edital.dataAbertura ? new Date(edital.dataAbertura).toLocaleDateString('pt-BR') : null} />
                <MetaCard label="Páginas" value={edital.pageCount?.toString()} />
                <MetaCard label="Tipo PDF" value={edital.pdfType} />
            </div>

            {/* Objeto */}
            {edital.objeto && (
                <div className="mb-8 rounded-lg border bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500">Objeto da Licitação</h3>
                    <p className="mt-1 text-sm text-gray-900">{edital.objeto}</p>
                </div>
            )}

            {/* Processing State */}
            {isProcessing && (
                <div className="mb-8 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <svg className="h-5 w-5 animate-spin text-blue-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm text-blue-800">
                        {edital.status === 'ocr_processing'
                            ? 'O PDF está sendo processado por OCR. Isso pode levar alguns minutos...'
                            : 'Os requisitos estão sendo extraídos pela IA. Atualizando automaticamente...'}
                    </p>
                </div>
            )}

            {/* Low Confidence Warning */}
            {lowConfidenceCount > 0 && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2">
                        <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <p className="text-sm font-medium text-amber-800">
                            {lowConfidenceCount} requisito(s) com confiança abaixo de 70% precisam de revisão
                        </p>
                    </div>
                </div>
            )}

            {/* Requisitos Section */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Requisitos Extraídos ({requisitos.length})
                    </h2>
                </div>

                {requisitos.length === 0 && !isProcessing ? (
                    <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
                        <p className="text-sm text-gray-500">
                            {edital.status === 'uploaded'
                                ? 'O edital ainda não foi processado.'
                                : edital.status === 'error'
                                    ? 'Houve um erro durante o processamento.'
                                    : 'Nenhum requisito encontrado neste edital.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {requisitos.map((req) => {
                            const reqStatus = REQUISITO_STATUS_CONFIG[req.status] ?? { label: req.status, color: 'bg-gray-100 text-gray-700' }
                            const lowConf = req.aiConfidenceScore < 70 && req.status === 'ai_extracted'

                            return (
                                <div
                                    key={req.id}
                                    className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${lowConf ? 'border-amber-300 ring-1 ring-amber-200' : ''
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            {/* Category + Lote */}
                                            <div className="mb-1 flex items-center gap-2">
                                                {req.lote && (
                                                    <span className="text-xs font-medium text-gray-500">
                                                        Lote: {req.lote}
                                                    </span>
                                                )}
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${reqStatus.color}`}>
                                                    {reqStatus.label}
                                                </span>
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getConfidenceColor(req.aiConfidenceScore)}`}>
                                                    Confiança: {req.aiConfidenceScore}%
                                                </span>
                                                {req.paginaReferencia && (
                                                    <span className="text-xs text-gray-400">
                                                        p. {req.paginaReferencia}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Description */}
                                            <p className="text-sm font-medium text-gray-900">{req.descricao}</p>

                                            {/* Quantitative */}
                                            {req.quantitativoExigido && (
                                                <p className="mt-1 text-xs text-gray-600">
                                                    Quantitativo: <span className="font-semibold">{req.quantitativoExigido} {req.unidade ?? ''}</span>
                                                </p>
                                            )}

                                            {/* Original excerpt */}
                                            {req.trechoOriginal && (
                                                <details className="mt-2">
                                                    <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                                                        Ver trecho original
                                                    </summary>
                                                    <p className="mt-1 rounded bg-gray-50 p-2 text-xs text-gray-600 italic">
                                                        &ldquo;{req.trechoOriginal}&rdquo;
                                                    </p>
                                                </details>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        {req.status === 'ai_extracted' && (
                                            <div className="flex shrink-0 gap-1">
                                                <button
                                                    onClick={() => updateRequisitoStatus(req.id, 'human_approved')}
                                                    disabled={updatingId === req.id}
                                                    className="rounded-md border border-green-300 bg-green-50 p-1.5 text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                                                    title="Aprovar"
                                                >
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => updateRequisitoStatus(req.id, 'human_rejected')}
                                                    disabled={updatingId === req.id}
                                                    className="rounded-md border border-red-300 bg-red-50 p-1.5 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                                    title="Rejeitar"
                                                >
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Cost Info */}
            {(edital.aiExtractionCostUsd || edital.ocrCostUsd) && (
                <div className="mt-8 rounded-lg border bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">
                        Custo de processamento: OCR ${edital.ocrCostUsd ?? '0'} + IA ${edital.aiExtractionCostUsd ?? '0'} USD
                    </p>
                </div>
            )}
        </div>
    )
}

function MetaCard({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{value ?? '—'}</p>
        </div>
    )
}
