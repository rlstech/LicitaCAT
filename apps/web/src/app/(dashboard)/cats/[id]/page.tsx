'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

/** Format a numeric value to Brazilian format: 9.999,56 */
function fmtBR(value: string | number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined || value === '') return '—'
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return '—'
    return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

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

interface EditDraft {
    descricao: string
    unidade: string
    quantidade: string
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
    const router = useRouter()
    const catId = params.id as string

    const [cat, setCat] = useState<Cat | null>(null)
    const [itens, setItens] = useState<CatItem[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [approving, setApproving] = useState(false)

    // Inline editing state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editDraft, setEditDraft] = useState<EditDraft>({ descricao: '', unidade: '', quantidade: '' })
    const [savingEdit, setSavingEdit] = useState(false)

    // Add item state
    const [showAddItem, setShowAddItem] = useState(false)
    const [newItem, setNewItem] = useState<EditDraft>({ descricao: '', unidade: '', quantidade: '' })
    const [addingItem, setAddingItem] = useState(false)

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

    async function handleDeleteCat() {
        setDeleting(true)
        try {
            const token = await getToken()
            const res = await fetch(`${API_URL}/api/cats/${catId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            })
            if (res.ok || res.status === 204) router.push('/cats')
        } catch { /* silent */ } finally {
            setDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    async function handleApprove() {
        setApproving(true)
        try {
            const token = await getToken()
            const res = await fetch(`${API_URL}/api/cats/${catId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ statusExtracao: 'completed' }),
            })
            if (res.ok) {
                const updated = await res.json() as Cat
                setCat(updated)
            }
        } catch { /* silent */ } finally {
            setApproving(false)
        }
    }

    function startEdit(item: CatItem) {
        setEditingId(item.id)
        setEditDraft({
            descricao: item.descricao,
            unidade: item.unidade ?? '',
            quantidade: item.quantidade ?? '',
        })
    }

    function cancelEdit() {
        setEditingId(null)
        setEditDraft({ descricao: '', unidade: '', quantidade: '' })
    }

    async function saveEdit(itemId: string) {
        setSavingEdit(true)
        try {
            const token = await getToken()
            const qtd = parseFloat(editDraft.quantidade)
            const res = await fetch(`${API_URL}/api/cats/${catId}/itens/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    descricao: editDraft.descricao.trim(),
                    unidade: editDraft.unidade.trim() || undefined,
                    quantidade: !isNaN(qtd) && qtd > 0 ? qtd : undefined,
                }),
            })
            if (res.ok) {
                const updated = await res.json() as CatItem
                setItens((prev) => prev.map((i) => i.id === itemId ? updated : i))
                setEditingId(null)
            }
        } catch { /* silent */ } finally {
            setSavingEdit(false)
        }
    }

    async function deleteItem(itemId: string) {
        const token = await getToken()
        await fetch(`${API_URL}/api/cats/${catId}/itens/${itemId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        })
        setItens((prev) => prev.filter((i) => i.id !== itemId))
    }

    async function handleAddItem() {
        if (!newItem.descricao.trim()) return
        setAddingItem(true)
        try {
            const token = await getToken()
            const qtd = parseFloat(newItem.quantidade)
            const res = await fetch(`${API_URL}/api/cats/${catId}/itens`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    descricao: newItem.descricao.trim(),
                    unidade: newItem.unidade.trim() || undefined,
                    quantidade: !isNaN(qtd) && qtd > 0 ? qtd : 1,
                    ordem: itens.length,
                }),
            })
            if (res.ok) {
                const created = await res.json() as CatItem
                setItens((prev) => [...prev, created])
                setNewItem({ descricao: '', unidade: '', quantidade: '' })
                setShowAddItem(false)
            }
        } catch { /* silent */ } finally {
            setAddingItem(false)
        }
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
    const isReviewMode = cat.statusExtracao === 'review_pending'

    return (
        <div>
            {/* Modal de confirmação de exclusão */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">Excluir CAT</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            Tem certeza que deseja excluir a CAT <span className="font-medium">{cat.numeroCat ?? cat.fileName}</span>?
                            Esta ação é irreversível e removerá todos os itens associados.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteCat}
                                disabled={deleting}
                                className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleting && <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                                Excluir CAT
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                    <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusInfo.color}`}>
                            {cat.statusExtracao === 'processing' && (
                                <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            )}
                            {statusInfo.label}
                        </span>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            Excluir
                        </button>
                    </div>
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
                <MetaCard label="Quantitativo" value={cat.quantitativoValor ? `${fmtBR(cat.quantitativoValor)} ${cat.quantitativoUnidade ?? ''}`.trim() : null} />
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

            {/* Review pending banner */}
            {isReviewMode && (
                <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-orange-800">Revisão necessária</p>
                            <p className="mt-1 text-sm text-orange-700">
                                A IA extraiu {itens.length} item(ns). Verifique, edite se necessário e clique em &quot;Aprovar Extração&quot; para finalizar.
                            </p>
                        </div>
                        <button
                            onClick={handleApprove}
                            disabled={approving}
                            className="inline-flex shrink-0 items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                            {approving
                                ? <><svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Aprovando...</>
                                : <>
                                    <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                    Aprovar Extração
                                </>
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* Itens */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Itens do Acervo ({itens.length})</h2>
                    {isReviewMode && (
                        <button
                            onClick={() => setShowAddItem(true)}
                            className="inline-flex items-center rounded-md border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
                        >
                            <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                            Adicionar Item
                        </button>
                    )}
                </div>

                {itens.length === 0 && cat.statusExtracao !== 'processing' ? (
                    <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
                        <p className="text-sm text-gray-500">Nenhum item extraído.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="w-12 px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">#</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Descrição</th>
                                    <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Qtd</th>
                                    <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Unidade</th>
                                    <th className="w-20 px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Origem</th>
                                    <th className="w-28 relative px-4 py-3"><span className="sr-only">Ações</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {itens.map((item, idx) => {
                                    const isEditing = editingId === item.id
                                    return (
                                        <tr key={item.id} className={isEditing ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 font-medium">{idx + 1}</td>

                                            {isEditing ? (
                                                <>
                                                    <td className="px-4 py-2">
                                                        <textarea
                                                            value={editDraft.descricao}
                                                            onChange={(e) => setEditDraft((d) => ({ ...d, descricao: e.target.value }))}
                                                            rows={2}
                                                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            value={editDraft.quantidade}
                                                            onChange={(e) => setEditDraft((d) => ({ ...d, quantidade: e.target.value }))}
                                                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                                            placeholder="0"
                                                            min="0"
                                                            step="any"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="text"
                                                            value={editDraft.unidade}
                                                            onChange={(e) => setEditDraft((d) => ({ ...d, unidade: e.target.value.toUpperCase() }))}
                                                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                                            placeholder="M2, UN, KG…"
                                                            maxLength={50}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">IA</span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-2 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => saveEdit(item.id)}
                                                                disabled={savingEdit || !editDraft.descricao.trim()}
                                                                className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                                            >
                                                                {savingEdit ? '...' : 'Salvar'}
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                disabled={savingEdit}
                                                                className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3 text-sm text-gray-900">{item.descricao}</td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{fmtBR(item.quantidade)}</td>
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
                                                        <div className="flex justify-end gap-3">
                                                            {isReviewMode && (
                                                                <button
                                                                    onClick={() => startEdit(item)}
                                                                    className="text-xs text-brand-600 hover:text-brand-800"
                                                                >
                                                                    Editar
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => deleteItem(item.id)}
                                                                className="text-xs text-red-600 hover:text-red-800"
                                                            >
                                                                Remover
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    )
                                })}

                                {/* Add item inline row */}
                                {showAddItem && (
                                    <tr className="bg-blue-50">
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400 font-medium">{itens.length + 1}</td>
                                        <td className="px-4 py-2">
                                            <textarea
                                                value={newItem.descricao}
                                                onChange={(e) => setNewItem((d) => ({ ...d, descricao: e.target.value }))}
                                                rows={2}
                                                placeholder="Descrição do item..."
                                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                                autoFocus
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                value={newItem.quantidade}
                                                onChange={(e) => setNewItem((d) => ({ ...d, quantidade: e.target.value }))}
                                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                                placeholder="1"
                                                min="0"
                                                step="any"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={newItem.unidade}
                                                onChange={(e) => setNewItem((d) => ({ ...d, unidade: e.target.value.toUpperCase() }))}
                                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                                placeholder="M2, UN…"
                                                maxLength={50}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Manual</span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={handleAddItem}
                                                    disabled={addingItem || !newItem.descricao.trim()}
                                                    className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                                                >
                                                    {addingItem ? '...' : 'Adicionar'}
                                                </button>
                                                <button
                                                    onClick={() => { setShowAddItem(false); setNewItem({ descricao: '', unidade: '', quantidade: '' }) }}
                                                    disabled={addingItem}
                                                    className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Bottom approve button (repeated for long lists) */}
                {isReviewMode && itens.length > 5 && (
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleApprove}
                            disabled={approving}
                            className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                            {approving
                                ? <><svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Aprovando...</>
                                : <><svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Aprovar Extração</>
                            }
                        </button>
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
