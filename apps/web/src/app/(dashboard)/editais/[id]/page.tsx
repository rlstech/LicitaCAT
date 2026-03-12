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
    uasg: string | null
    numeroEdital: string | null
    modalidade: string | null
    objeto: string | null
    valorEstimado: string | null
    dataAbertura: string | null
    status: string
    regimeExecucao: string | null
    leiRegente: string | null
    admiteConsorcio: boolean | null
    prazoExecucaoMeses: number | null
    aiExtractionCostUsd: string | null
    createdAt: string
}

interface Habilitacao {
    habilitacaoJuridica: Array<{ id: string; documento: string; aplicaA: string | null; observacao: string | null }>
    regularidadeFiscal: Array<{ id: string; documento: string; sigla: string | null; validadeDias: number | null; observacao: string | null }>
    qualificacaoTecnica: {
        registroConselho: string | null
        exigeVisitaTecnica: boolean
        visitaTipo: string | null
        exigeEscritorioLocal: boolean
        escritorioDescricao: string | null
    } | null
    profissionais: Array<{ id: string; cargo: string; conselho: string | null; quantidade: number | null; cbo: string | null; observacao: string | null }>
    parcelasRelevancia: Array<{ id: string; servico: string; unidade: string | null; quantidadeMinima: string | null; observacao: string | null }>
    atestadosProfissionais: Array<{ id: string; profissional: string; caracteristicasExigidas: string | null; exigeCat: boolean; observacao: string | null }>
    qualificacaoFinanceira: {
        exigeBalanco: boolean
        balancoExercicios: number | null
        patrimonioLiquidoMinimo: string | null
        lcMinimo: string | null
        lgMinimo: string | null
        sgMinimo: string | null
        exigeCertidaoFalencia: boolean
        certidaoFalenciaPrazoDias: number | null
        exigeCapitalSocialMinimo: boolean
        capitalSocialMinimo: string | null
        exigeGarantiaProposta: boolean
        garantiaPropostaPercentual: string | null
        observacao: string | null
    } | null
    declaracoes: Array<{ id: string; descricao: string; baseLegal: string | null; leiEstadual: boolean; penalidadeOmissao: string | null }>
    declaracoesEspeciais: Array<{ id: string; descricao: string; lei: string | null; uf: string | null }>
    alertas: Array<{ id: string; nivel: string; categoria: string | null; descricao: string }>
    anexosReferenciados: Array<{ id: string; identificacao: string; descricao: string | null }>
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    uploaded: { label: 'Enviado', color: 'bg-gray-100 text-gray-700' },
    ocr_processing: { label: 'Processando', color: 'bg-yellow-100 text-yellow-800' },
    extracting: { label: 'Extraindo dados', color: 'bg-blue-100 text-blue-800' },
    review_pending: { label: 'Aguardando revisão', color: 'bg-orange-100 text-orange-800' },
    ready: { label: 'Pronto', color: 'bg-green-100 text-green-700' },
    error: { label: 'Erro', color: 'bg-red-100 text-red-700' },
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

const ALERTA_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    critico: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Crítico' },
    atencao: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', label: 'Atenção' },
    informacao: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Info' },
}

function Section({ title, count, children, highlight }: {
    title: string
    count?: number
    children: React.ReactNode
    highlight?: boolean
}) {
    const [open, setOpen] = useState(true)
    return (
        <div className={`rounded-lg border bg-white shadow-sm ${highlight ? 'border-brand-300 ring-1 ring-brand-100' : ''}`}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${highlight ? 'text-brand-700' : 'text-gray-800'}`}>{title}</span>
                    {count !== undefined && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{count}</span>
                    )}
                    {highlight && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">para cruzamento</span>
                    )}
                </div>
                <svg
                    className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && <div className="border-t px-4 pb-4 pt-3">{children}</div>}
        </div>
    )
}

export default function EditalDetailPage() {
    const { getToken, isLoaded } = useAuth()
    const params = useParams()
    const router = useRouter()
    const editalId = params.id as string

    const [edital, setEdital] = useState<Edital | null>(null)
    const [habilitacao, setHabilitacao] = useState<Habilitacao | null>(null)
    const [loading, setLoading] = useState(true)
    const [approving, setApproving] = useState(false)
    const [triggeringCrossing, setTriggeringCrossing] = useState(false)
    const [reprocessing, setReprocessing] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const fetchData = useCallback(async () => {
        try {
            const token = await getToken()
            const headers = {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            }

            const editalRes = await fetch(`${API_URL}/api/editais/${editalId}`, { headers })
            if (editalRes.ok) {
                const e = await editalRes.json() as Edital
                setEdital(e)

                if (e.status === 'review_pending' || e.status === 'ready') {
                    const habRes = await fetch(`${API_URL}/api/editais/${editalId}/habilitacao`, { headers })
                    if (habRes.ok) {
                        setHabilitacao(await habRes.json() as Habilitacao)
                    }
                }
            }
        } catch {
            // fail silently
        } finally {
            setLoading(false)
        }
    }, [getToken, editalId])

    useEffect(() => {
        if (!isLoaded) return
        fetchData()

        const interval = setInterval(() => {
            if (!edital || ['uploading', 'extracting'].includes(edital.status)) {
                fetchData()
            }
        }, 5000)
        return () => clearInterval(interval)
    }, [fetchData, isLoaded, edital?.status])

    async function approveEdital() {
        setApproving(true)
        try {
            const token = await getToken()
            const res = await fetch(`${API_URL}/api/editais/${editalId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            })
            if (res.ok) {
                setEdital((prev) => prev ? { ...prev, status: 'ready' } : prev)
            }
        } catch {
            // fail silently
        } finally {
            setApproving(false)
        }
    }

    async function triggerCrossing() {
        setTriggeringCrossing(true)
        try {
            const token = await getToken()
            const res = await fetch(`${API_URL}/api/crossings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ editalId }),
            })
            if (res.ok) {
                const data = await res.json() as { crossingId: string }
                router.push(`/cruzamentos/${data.crossingId}`)
            }
        } catch {
            // fail silently
        } finally {
            setTriggeringCrossing(false)
        }
    }

    async function deleteEdital() {
        setDeleting(true)
        try {
            const token = await getToken()
            const res = await fetch(`${API_URL}/api/editais/${editalId}`, {
                method: 'DELETE',
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            })
            if (res.ok) router.push('/editais')
        } catch {
            // fail silently
        } finally {
            setDeleting(false)
            setConfirmDelete(false)
        }
    }

    async function reprocessEdital() {
        setReprocessing(true)
        try {
            const token = await getToken()
            const res = await fetch(`${API_URL}/api/editais/${editalId}/reprocess`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            })
            if (res.ok) {
                setEdital((prev) => prev ? { ...prev, status: 'extracting' } : prev)
            }
        } catch {
            // fail silently
        } finally {
            setReprocessing(false)
        }
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
                <Link href="/editais" className="mt-4 text-brand-600 hover:text-brand-700">← Voltar para editais</Link>
            </div>
        )
    }

    const statusInfo = STATUS_CONFIG[edital.status] ?? { label: edital.status, color: 'bg-gray-100 text-gray-700' }
    const isProcessing = ['uploaded', 'extracting'].includes(edital.status)

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
                    <div className="flex items-center gap-3">
                        {/* Delete button */}
                        {confirmDelete ? (
                            <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2">
                                <span className="text-sm text-red-700">Confirmar exclusão?</span>
                                <button
                                    onClick={deleteEdital}
                                    disabled={deleting}
                                    className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                    {deleting ? 'Excluindo...' : 'Sim, excluir'}
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="rounded bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 border border-gray-300"
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                                Excluir
                            </button>
                        )}
                        {edital.status === 'error' && (
                            <button
                                onClick={reprocessEdital}
                                disabled={reprocessing}
                                className="inline-flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
                            >
                                {reprocessing ? (
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                    </svg>
                                )}
                                {reprocessing ? 'Reprocessando...' : 'Reprocessar'}
                            </button>
                        )}
                        {edital.status === 'review_pending' && (
                            <button
                                onClick={approveEdital}
                                disabled={approving}
                                className="inline-flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                            >
                                {approving ? (
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                )}
                                {approving ? 'Aprovando...' : 'Aprovar Extração'}
                            </button>
                        )}
                        {edital.status === 'ready' && (
                            <button
                                onClick={triggerCrossing}
                                disabled={triggeringCrossing}
                                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                            >
                                {triggeringCrossing ? (
                                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                )}
                                {triggeringCrossing ? 'Iniciando...' : 'Iniciar Cruzamento'}
                            </button>
                        )}
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
            </div>

            {/* Metadata Cards */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <MetaCard label="Órgão" value={edital.orgaoLicitante} />
                <MetaCard label="UASG" value={edital.uasg} />
                <MetaCard label="Modalidade" value={edital.modalidade ? MODALIDADE_LABELS[edital.modalidade] ?? edital.modalidade : null} />
                <MetaCard label="Valor Estimado" value={edital.valorEstimado ? `R$ ${parseFloat(edital.valorEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                <MetaCard label="Data Abertura" value={edital.dataAbertura ? new Date(edital.dataAbertura).toLocaleDateString('pt-BR') : null} />
                <MetaCard label="Prazo Execução" value={edital.prazoExecucaoMeses ? `${edital.prazoExecucaoMeses} meses` : null} />
            </div>

            {/* Extra metadata */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <MetaCard label="Regime de Execução" value={edital.regimeExecucao} />
                <MetaCard label="Lei Regente" value={edital.leiRegente} />
                <MetaCard label="Admite Consórcio" value={edital.admiteConsorcio == null ? null : edital.admiteConsorcio ? 'Sim' : 'Não'} />
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
                        {edital.status === 'uploaded'
                            ? 'O edital está na fila de processamento...'
                            : 'Os dados de habilitação estão sendo extraídos pelo Claude. Atualizando automaticamente...'}
                    </p>
                </div>
            )}

            {/* Habilitação Data */}
            {habilitacao && (
                <div className="space-y-4">
                    {/* Alertas */}
                    {habilitacao.alertas.length > 0 && (
                        <div className="space-y-2">
                            {habilitacao.alertas.map((alerta) => {
                                const cfg = ALERTA_CONFIG[alerta.nivel] ?? ALERTA_CONFIG['informacao']!
                                return (
                                    <div key={alerta.id} className={`flex items-start gap-3 rounded-lg border p-3 ${cfg.bg}`}>
                                        <span className={`shrink-0 text-xs font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
                                        {alerta.categoria && <span className="text-xs text-gray-500">[{alerta.categoria}]</span>}
                                        <p className={`text-sm ${cfg.color}`}>{alerta.descricao}</p>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* 1. Habilitação Jurídica */}
                    {habilitacao.habilitacaoJuridica.length > 0 && (
                        <Section title="1 — Habilitação Jurídica" count={habilitacao.habilitacaoJuridica.length}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-gray-500">
                                        <th className="pb-2 text-left font-medium">Documento</th>
                                        <th className="pb-2 text-left font-medium">Aplica a</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {habilitacao.habilitacaoJuridica.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-2 pr-4 text-gray-900">{item.documento}</td>
                                            <td className="py-2 text-gray-500">{item.aplicaA ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Section>
                    )}

                    {/* 2. Regularidade Fiscal */}
                    {habilitacao.regularidadeFiscal.length > 0 && (
                        <Section title="2 — Regularidade Fiscal, Social e Trabalhista" count={habilitacao.regularidadeFiscal.length}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-gray-500">
                                        <th className="pb-2 text-left font-medium">Documento</th>
                                        <th className="pb-2 text-left font-medium">Sigla</th>
                                        <th className="pb-2 text-left font-medium">Validade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {habilitacao.regularidadeFiscal.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-2 pr-4 text-gray-900">{item.documento}</td>
                                            <td className="py-2 pr-4 text-gray-500">{item.sigla ?? '—'}</td>
                                            <td className="py-2 text-gray-500">{item.validadeDias ? `${item.validadeDias} dias` : (item.observacao ?? '—')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Section>
                    )}

                    {/* 3. Qualificação Técnica (key-value) */}
                    {habilitacao.qualificacaoTecnica && (
                        <Section title="3 — Qualificação Técnica — Dados Gerais">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <KV label="Registro Conselho" value={habilitacao.qualificacaoTecnica.registroConselho} />
                                <KV label="Visita Técnica" value={habilitacao.qualificacaoTecnica.exigeVisitaTecnica ? (habilitacao.qualificacaoTecnica.visitaTipo ?? 'Sim') : 'Não exigida'} />
                                <KV label="Escritório Local" value={habilitacao.qualificacaoTecnica.exigeEscritorioLocal ? (habilitacao.qualificacaoTecnica.escritorioDescricao ?? 'Exigido') : 'Não exigido'} />
                            </div>
                        </Section>
                    )}

                    {/* 4. Profissionais Exigidos */}
                    {habilitacao.profissionais.length > 0 && (
                        <Section title="4 — Profissionais Exigidos" count={habilitacao.profissionais.length}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-gray-500">
                                        <th className="pb-2 text-left font-medium">Cargo / Função</th>
                                        <th className="pb-2 text-left font-medium">Conselho</th>
                                        <th className="pb-2 text-left font-medium">Qtd</th>
                                        <th className="pb-2 text-left font-medium">CBO</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {habilitacao.profissionais.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-2 pr-4 text-gray-900">{item.cargo}</td>
                                            <td className="py-2 pr-4 text-gray-500">{item.conselho ?? '—'}</td>
                                            <td className="py-2 pr-4 text-gray-500">{item.quantidade ?? '—'}</td>
                                            <td className="py-2 text-gray-500">{item.cbo ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Section>
                    )}

                    {/* 5. Parcelas de Relevância — HIGHLIGHT */}
                    <Section title="5 — Parcelas de Relevância" count={habilitacao.parcelasRelevancia.length} highlight>
                        {habilitacao.parcelasRelevancia.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">Nenhuma parcela de relevância extraída.</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-gray-500">
                                        <th className="pb-2 text-left font-medium">Serviço / Obra</th>
                                        <th className="pb-2 text-left font-medium">Qtd Mínima</th>
                                        <th className="pb-2 text-left font-medium">Unidade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {habilitacao.parcelasRelevancia.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-2 pr-4 font-medium text-brand-700">{item.servico}</td>
                                            <td className="py-2 pr-4 text-gray-900 font-semibold">{item.quantidadeMinima ?? '—'}</td>
                                            <td className="py-2 text-gray-500">{item.unidade ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Section>

                    {/* 6. Atestados de Profissionais */}
                    {habilitacao.atestadosProfissionais.length > 0 && (
                        <Section title="6 — Atestados de Profissionais" count={habilitacao.atestadosProfissionais.length}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-gray-500">
                                        <th className="pb-2 text-left font-medium">Profissional</th>
                                        <th className="pb-2 text-left font-medium">Características Exigidas</th>
                                        <th className="pb-2 text-left font-medium">Exige CAT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {habilitacao.atestadosProfissionais.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-2 pr-4 text-gray-900">{item.profissional}</td>
                                            <td className="py-2 pr-4 text-gray-500">{item.caracteristicasExigidas ?? '—'}</td>
                                            <td className="py-2 text-gray-500">{item.exigeCat ? 'Sim' : 'Não'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Section>
                    )}

                    {/* 7. Qualificação Financeira (key-value) */}
                    {habilitacao.qualificacaoFinanceira && (
                        <Section title="7 — Qualificação Econômico-Financeira">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <KV label="Exige Balanço" value={habilitacao.qualificacaoFinanceira.exigeBalanco ? `Sim (${habilitacao.qualificacaoFinanceira.balancoExercicios ?? '?'} exercícios)` : 'Não'} />
                                <KV label="Patrimônio Líquido Mínimo" value={habilitacao.qualificacaoFinanceira.patrimonioLiquidoMinimo ? `R$ ${parseFloat(habilitacao.qualificacaoFinanceira.patrimonioLiquidoMinimo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                                <KV label="LC Mínimo" value={habilitacao.qualificacaoFinanceira.lcMinimo} />
                                <KV label="LG Mínimo" value={habilitacao.qualificacaoFinanceira.lgMinimo} />
                                <KV label="SG Mínimo" value={habilitacao.qualificacaoFinanceira.sgMinimo} />
                                <KV label="Certidão de Falência" value={habilitacao.qualificacaoFinanceira.exigeCertidaoFalencia ? `Sim${habilitacao.qualificacaoFinanceira.certidaoFalenciaPrazoDias ? ` (${habilitacao.qualificacaoFinanceira.certidaoFalenciaPrazoDias} dias)` : ''}` : 'Não'} />
                                <KV label="Capital Social Mínimo" value={habilitacao.qualificacaoFinanceira.capitalSocialMinimo ? `R$ ${parseFloat(habilitacao.qualificacaoFinanceira.capitalSocialMinimo).toLocaleString('pt-BR')}` : null} />
                                <KV label="Garantia de Proposta" value={habilitacao.qualificacaoFinanceira.exigeGarantiaProposta ? `${habilitacao.qualificacaoFinanceira.garantiaPropostaPercentual ?? '?'}%` : 'Não'} />
                            </div>
                            {habilitacao.qualificacaoFinanceira.observacao && (
                                <p className="mt-3 text-xs text-gray-500 italic">{habilitacao.qualificacaoFinanceira.observacao}</p>
                            )}
                        </Section>
                    )}

                    {/* 8. Declarações */}
                    {habilitacao.declaracoes.length > 0 && (
                        <Section title="8 — Declarações" count={habilitacao.declaracoes.length}>
                            <ul className="space-y-2 text-sm">
                                {habilitacao.declaracoes.map((item) => (
                                    <li key={item.id} className="flex items-start gap-2">
                                        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-400" />
                                        <div>
                                            <span className="text-gray-900">{item.descricao}</span>
                                            {item.baseLegal && <span className="ml-2 text-xs text-gray-400">({item.baseLegal})</span>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}

                    {/* 9. Declarações Especiais (lei estadual) */}
                    {habilitacao.declaracoesEspeciais.length > 0 && (
                        <Section title="9 — Declarações por Lei Estadual" count={habilitacao.declaracoesEspeciais.length}>
                            <ul className="space-y-2 text-sm">
                                {habilitacao.declaracoesEspeciais.map((item) => (
                                    <li key={item.id} className="flex items-start gap-2">
                                        <span className="mt-0.5 shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                                            {item.uf ?? 'UF?'}
                                        </span>
                                        <div>
                                            <span className="text-gray-900">{item.descricao}</span>
                                            {item.lei && <span className="ml-2 text-xs text-gray-400">({item.lei})</span>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}

                    {/* 10. Anexos Referenciados */}
                    {habilitacao.anexosReferenciados.length > 0 && (
                        <Section title="10 — Anexos Referenciados" count={habilitacao.anexosReferenciados.length}>
                            <ul className="space-y-1 text-sm">
                                {habilitacao.anexosReferenciados.map((item) => (
                                    <li key={item.id} className="flex items-center gap-2">
                                        <span className="font-medium text-gray-700">{item.identificacao}:</span>
                                        <span className="text-gray-500">{item.descricao ?? '—'}</span>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}
                </div>
            )}

            {/* Cost Info */}
            {edital.aiExtractionCostUsd && (
                <div className="mt-8 rounded-lg border bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">
                        Custo de extração: ${edital.aiExtractionCostUsd} USD (Claude)
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

function KV({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div>
            <span className="text-xs text-gray-500">{label}: </span>
            <span className="text-sm text-gray-900">{value ?? '—'}</span>
        </div>
    )
}
