'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useToken } from '@/hooks/use-token'
import { useSession } from '@/lib/auth-client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

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

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  pending:        { label: 'Pendente',          dot: 'bg-slate-400',  bg: 'bg-slate-100',  text: 'text-slate-600'  },
  processing:     { label: 'Processando',        dot: 'bg-brand-500',  bg: 'bg-brand-50',   text: 'text-brand-700'  },
  review_pending: { label: 'Revisão pendente',   dot: 'bg-amber-500',  bg: 'bg-amber-50',   text: 'text-amber-700'  },
  completed:      { label: 'Completa',           dot: 'bg-green-500',  bg: 'bg-green-50',   text: 'text-green-700'  },
  error:          { label: 'Erro',               dot: 'bg-red-500',    bg: 'bg-red-50',     text: 'text-red-700'    },
}

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function MetaCard({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--canvas)', border: '1px solid var(--border-soft)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-900">
        {value ?? <span className="font-normal text-slate-300">—</span>}
      </p>
    </div>
  )
}

export default function CatDetailPage() {
  const getToken = useToken()
  const { isPending } = useSession()
  const params = useParams()
  const router = useRouter()
  const catId = params.id as string

  const [cat, setCat] = useState<Cat | null>(null)
  const [itens, setItens] = useState<CatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [approving, setApproving] = useState(false)

  const [itemFilter, setItemFilter] = useState('')
  const filteredItens = useMemo(() => {
    const q = itemFilter.trim().toLowerCase()
    if (!q) return itens
    return itens.filter(i => i.descricao.toLowerCase().includes(q) || (i.unidade ?? '').toLowerCase().includes(q))
  }, [itens, itemFilter])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({ descricao: '', unidade: '', quantidade: '' })
  const [savingEdit, setSavingEdit] = useState(false)

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
    if (!!isPending) return
    fetchData()
    const interval = setInterval(() => {
      if (!cat || cat.statusExtracao === 'processing') fetchData()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchData, !isPending, cat?.statusExtracao])

  async function handleDeleteCat() {
    setDeleting(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/cats/${catId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok || res.status === 204) router.push('/cats')
    } catch { /* silent */ } finally { setDeleting(false); setShowDeleteConfirm(false) }
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
      if (res.ok) setCat(await res.json() as Cat)
    } catch { /* silent */ } finally { setApproving(false) }
  }

  function startEdit(item: CatItem) {
    setEditingId(item.id)
    setEditDraft({ descricao: item.descricao, unidade: item.unidade ?? '', quantidade: item.quantidade ?? '' })
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
        setItens(prev => prev.map(i => i.id === itemId ? updated : i))
        setEditingId(null)
      }
    } catch { /* silent */ } finally { setSavingEdit(false) }
  }

  async function deleteItem(itemId: string) {
    const token = await getToken()
    await fetch(`${API_URL}/api/cats/${catId}/itens/${itemId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    setItens(prev => prev.filter(i => i.id !== itemId))
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
        setItens(prev => [...prev, created])
        setNewItem({ descricao: '', unidade: '', quantidade: '' })
        setShowAddItem(false)
      }
    } catch { /* silent */ } finally { setAddingItem(false) }
  }

  // ── Loading / not found ────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="h-6 w-6 text-brand-500" />
    </div>
  )

  if (!cat) return (
    <div className="py-24 text-center">
      <p className="text-sm text-slate-500">CAT não encontrada.</p>
      <Link href="/cats" className="mt-3 inline-block text-sm text-brand-600 hover:text-brand-700">← Voltar</Link>
    </div>
  )

  const statusInfo = STATUS_CONFIG[cat.statusExtracao] ?? { label: cat.statusExtracao, dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-600' }
  const isReviewMode = cat.statusExtracao === 'review_pending'

  return (
    <div className="max-w-5xl space-y-5 pb-12">

      {/* ── Delete modal ── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white"
            style={{ boxShadow: '0 25px 50px rgba(15,23,42,0.20), 0 0 0 1px rgba(15,23,42,0.10)' }}
          >
            <div className="px-6 py-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
                <svg className="h-4.5 w-4.5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Excluir CAT</h3>
              <p className="mt-1.5 text-sm text-slate-500">
                Tem certeza que deseja excluir a CAT{' '}
                <span className="font-medium text-slate-900">{cat.numeroCat ?? cat.fileName}</span>?
                {' '}Esta ação é irreversível.
              </p>
            </div>
            <div
              className="flex justify-end gap-2 px-6 py-3"
              style={{ borderTop: '1px solid var(--border-soft)', backgroundColor: 'var(--canvas)' }}
            >
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white disabled:opacity-50"
                style={{ border: '1px solid var(--border)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteCat}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Spinner className="h-3.5 w-3.5" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Breadcrumb ── */}
      <Link href="/cats" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-700">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        CATs
      </Link>

      {/* ── Summary card ── */}
      <div
        className="overflow-hidden rounded-xl bg-white"
        style={{ border: '1px solid var(--border)', borderTop: '3px solid #0e7490' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                {cat.numeroCat ?? cat.fileName}
              </h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusInfo.bg} ${statusInfo.text}`}>
                {cat.statusExtracao === 'processing'
                  ? <Spinner className="h-2.5 w-2.5" />
                  : <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                }
                {statusInfo.label}
              </span>
              {cat.aiConfidenceScore !== null && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] text-slate-500"
                  style={{ backgroundColor: 'var(--canvas)' }}
                >
                  Confiança IA: {cat.aiConfidenceScore}%
                </span>
              )}
            </div>
            {cat.numeroCat && <p className="mt-1 text-xs text-slate-400">{cat.fileName}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isReviewMode && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                style={{ border: '1px solid rgba(22,163,74,0.2)', backgroundColor: 'rgba(240,253,244,0.8)' }}
              >
                {approving ? <Spinner /> : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {approving ? 'Aprovando…' : 'Aprovar extração'}
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-red-500"
              style={{ border: '1px solid var(--border)' }}
              title="Excluir CAT"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <MetaCard label="Profissional" value={cat.profissional?.nome ?? null} />
            <MetaCard label="Contratante" value={cat.empresaContratante} />
            <MetaCard label="Tipo de obra" value={cat.tipoObraServico} />
            <MetaCard label="Período" value={
              cat.dataInicio && cat.dataConclusao
                ? `${new Date(cat.dataInicio).toLocaleDateString('pt-BR')} — ${new Date(cat.dataConclusao).toLocaleDateString('pt-BR')}`
                : cat.dataInicio ? `Início: ${new Date(cat.dataInicio).toLocaleDateString('pt-BR')}` : null
            } />
            <MetaCard label="Quantitativo" value={cat.quantitativoValor ? `${fmtBR(cat.quantitativoValor)} ${cat.quantitativoUnidade ?? ''}`.trim() : null} />
          </div>
        </div>

        {/* Descrição técnica */}
        {cat.descricaoTecnica && (
          <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Descrição Técnica</p>
            <p className="text-sm leading-relaxed text-slate-700">{cat.descricaoTecnica}</p>
          </div>
        )}

        {/* Processing banner */}
        {cat.statusExtracao === 'processing' && (
          <div
            className="flex items-center gap-2.5 px-6 py-3"
            style={{ borderTop: '1px solid rgba(124,58,237,0.15)', backgroundColor: 'rgba(124,58,237,0.04)' }}
          >
            <Spinner className="h-3.5 w-3.5 text-brand-500" />
            <p className="text-sm text-brand-700">Extraindo dados da CAT com IA…</p>
          </div>
        )}

        {/* Review banner */}
        {isReviewMode && (
          <div
            className="flex items-center gap-2.5 px-6 py-3"
            style={{ borderTop: '1px solid rgba(217,119,6,0.2)', borderLeft: '3px solid #d97706', backgroundColor: 'rgba(251,191,36,0.05)' }}
          >
            <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-amber-700">
              A IA extraiu <strong>{itens.length} item(ns)</strong>. Verifique, edite se necessário e aprove para finalizar.
            </p>
          </div>
        )}
      </div>

      {/* ── Items section ── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Itens do Acervo
            <span className="ml-1.5 font-normal text-slate-400">
              ({itemFilter ? `${filteredItens.length} de ${itens.length}` : itens.length})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {/* Filter */}
            <div className="relative">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
                placeholder="Filtrar itens…"
                className="w-48 rounded-lg py-1.5 pl-8 pr-8 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
              />
              {itemFilter && (
                <button
                  onClick={() => setItemFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {isReviewMode && (
              <button
                onClick={() => setShowAddItem(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-white"
                style={{ border: '1px solid var(--border)' }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Adicionar item
              </button>
            )}
          </div>
        </div>

        {itens.length === 0 && cat.statusExtracao !== 'processing' ? (
          <div
            className="rounded-xl bg-white px-6 py-12 text-center"
            style={{ border: '1px solid var(--border)' }}
          >
            <div
              className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(14,116,144,0.08)' }}
            >
              <svg className="h-5 w-5 text-cyan-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">Nenhum item extraído</p>
            <p className="mt-0.5 text-xs text-slate-400">Aguardando processamento da IA.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white" style={{ border: '1px solid var(--border)' }}>
            <table className="min-w-full">
              <thead>
                <tr style={{ backgroundColor: 'var(--canvas)', borderBottom: '1px solid var(--border-soft)' }}>
                  <th className="w-10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Descrição</th>
                  <th className="w-28 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Qtd</th>
                  <th className="w-24 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Un</th>
                  <th className="w-20 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Origem</th>
                  <th className="w-28 relative px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredItens.length === 0 && itemFilter ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                      Nenhum item para &ldquo;{itemFilter}&rdquo;.
                    </td>
                  </tr>
                ) : filteredItens.map((item, idx) => {
                  const isEditing = editingId === item.id
                  return (
                    <tr
                      key={item.id}
                      className={isEditing ? '' : 'transition-colors hover:bg-slate-50'}
                      style={{
                        borderTop: '1px solid var(--border-soft)',
                        backgroundColor: isEditing ? 'rgba(251,191,36,0.04)' : undefined,
                      }}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-400">{idx + 1}</td>

                      {isEditing ? (
                        <>
                          <td className="px-4 py-2">
                            <textarea
                              value={editDraft.descricao}
                              onChange={(e) => setEditDraft(d => ({ ...d, descricao: e.target.value }))}
                              rows={2}
                              className="w-full rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none"
                              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={editDraft.quantidade}
                              onChange={(e) => setEditDraft(d => ({ ...d, quantidade: e.target.value }))}
                              className="w-full rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none"
                              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
                              placeholder="0" min="0" step="any"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={editDraft.unidade}
                              onChange={(e) => setEditDraft(d => ({ ...d, unidade: e.target.value }))}
                              className="w-full rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
                              placeholder="M2, Un…" maxLength={50}
                            />
                          </td>
                          <td />
                          <td className="px-4 py-2">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => saveEdit(item.id)}
                                disabled={savingEdit || !editDraft.descricao.trim()}
                                className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                              >
                                {savingEdit ? '…' : 'Salvar'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={savingEdit}
                                className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                                style={{ border: '1px solid var(--border)' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm text-slate-800">{item.descricao}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-600">{fmtBR(item.quantidade)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{item.unidade ?? '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              item.origem === 'ai_extracted' ? 'bg-brand-50 text-brand-700'
                              : item.origem === 'human_added' ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                            }`}>
                              {item.origem === 'ai_extracted' ? 'IA' : item.origem === 'human_added' ? 'Manual' : 'Excel'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex justify-end gap-3">
                              {isReviewMode && (
                                <button
                                  onClick={() => startEdit(item)}
                                  className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
                                >
                                  Editar
                                </button>
                              )}
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="text-xs font-medium text-slate-400 transition-colors hover:text-red-500"
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

                {/* Add item row */}
                {showAddItem && (
                  <tr style={{ borderTop: '1px solid var(--border-soft)', backgroundColor: 'var(--canvas)' }}>
                    <td className="px-4 py-3 text-sm text-slate-400">{itens.length + 1}</td>
                    <td className="px-4 py-2">
                      <textarea
                        value={newItem.descricao}
                        onChange={(e) => setNewItem(d => ({ ...d, descricao: e.target.value }))}
                        rows={2} placeholder="Descrição do item…"
                        className="w-full rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                        style={{ border: '1px solid var(--border)', backgroundColor: 'white' }}
                        autoFocus
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={newItem.quantidade}
                        onChange={(e) => setNewItem(d => ({ ...d, quantidade: e.target.value }))}
                        className="w-full rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none"
                        style={{ border: '1px solid var(--border)', backgroundColor: 'white' }}
                        placeholder="1" min="0" step="any"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={newItem.unidade}
                        onChange={(e) => setNewItem(d => ({ ...d, unidade: e.target.value }))}
                        className="w-full rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                        style={{ border: '1px solid var(--border)', backgroundColor: 'white' }}
                        placeholder="M2, Un…" maxLength={50}
                      />
                    </td>
                    <td />
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={handleAddItem}
                          disabled={addingItem || !newItem.descricao.trim()}
                          className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                        >
                          {addingItem ? '…' : 'Adicionar'}
                        </button>
                        <button
                          onClick={() => { setShowAddItem(false); setNewItem({ descricao: '', unidade: '', quantidade: '' }) }}
                          disabled={addingItem}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-white disabled:opacity-50"
                          style={{ border: '1px solid var(--border)' }}
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

        {/* Bottom approve — listas longas */}
        {isReviewMode && itens.length > 8 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleApprove}
              disabled={approving}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
              style={{ border: '1px solid rgba(22,163,74,0.2)', backgroundColor: 'rgba(240,253,244,0.8)' }}
            >
              {approving ? <Spinner /> : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              {approving ? 'Aprovando…' : 'Aprovar extração'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
