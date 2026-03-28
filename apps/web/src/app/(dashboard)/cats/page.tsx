'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Cat {
  id: string
  fileName: string
  numeroCat: string | null
  empresaContratante: string | null
  tipoObraServico: string | null
  descricaoTecnica: string | null
  statusExtracao: string
  profissionalId: string
  createdAt: string
  itemCount: number
}

interface CatsResponse {
  data: Cat[]
  total: number
  page: number
  limit: number
}

interface SearchResult {
  id: string
  catId: string
  descricao: string
  unidade: string | null
  quantidade: string | null
  numeroCat: string | null
  empresaContratante: string | null
  tipoObraServico: string | null
  fileName: string
}

interface EditForm {
  numeroCat: string
  empresaContratante: string
  tipoObraServico: string
  descricaoTecnica: string
}

interface EmbeddingStatus {
  totalCats: number
  catsWithEmbedding: number
  totalItems: number
  itemsWithEmbedding: number
  totalAll: number
  doneAll: number
  progressPercent: number
  isProcessing: boolean
  jobs: { queued: number; running: number; completed: number; failed: number }
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  pending:        { label: 'Pendente',         dot: 'bg-slate-500',   bg: 'bg-slate-100',   text: 'text-slate-800',   border: 'border-slate-200' },
  processing:     { label: 'Extraindo...',     dot: 'bg-[#003746]',   bg: 'bg-[#003746]/5', text: 'text-[#003746]',   border: 'border-[#003746]/10' },
  review_pending: { label: 'Revisão',          dot: 'bg-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-800',   border: 'border-amber-100' },
  completed:      { label: 'Finalizado',       dot: 'bg-emerald-700', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-100' },
  error:          { label: 'Erro de OCR',      dot: 'bg-red-500',     bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-100' },
}

const ITEMS_PER_PAGE = 20

function fmtQty(v: string | null) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function CatsPage() {
  const { getToken } = useAuth()

  const [cats, setCats] = useState<Cat[]>([])
  const [allCats, setAllCats] = useState<Cat[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [editingCat, setEditingCat] = useState<Cat | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ numeroCat: '', empresaContratante: '', tipoObraServico: '', descricaoTecnica: '' })
  const [saving, setSaving] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCatId, setSearchCatId] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [rebuilding, setRebuilding] = useState(false)
  const [normalizing, setNormalizing] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const [embStatus, setEmbStatus] = useState<EmbeddingStatus | null>(null)
  const [showEmbPanel, setShowEmbPanel] = useState(false)
  const embPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Data fetching ──
  const fetchCats = useCallback(async () => {
    try {
      const token = await getToken()
      const h = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      const res = await fetch(`${API_URL}/api/cats?page=${page}&limit=${ITEMS_PER_PAGE}`, { headers: h })
      if (res.ok) {
        const data = (await res.json()) as CatsResponse
        setCats(data.data)
        setTotal(data.total)
      }
      if (allCats.length === 0) {
        const allRes = await fetch(`${API_URL}/api/cats?page=1&limit=500`, { headers: h })
        if (allRes.ok) {
          const allData = (await allRes.json()) as CatsResponse
          setAllCats(allData.data)
        }
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getToken, page, allCats.length])

  useEffect(() => {
    fetchCats()
    const interval = setInterval(fetchCats, 10000)
    return () => clearInterval(interval)
  }, [fetchCats])

  // ── Search ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (searchInput.trim().length < 2) { setSearchQuery(''); setSearchResults([]); return }
    debounceRef.current = setTimeout(() => { setSearchQuery(searchInput.trim()) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  useEffect(() => {
    if (!searchQuery) return
    setSearching(true)
    ;(async () => {
      try {
        const token = await getToken()
        const params = new URLSearchParams({ q: searchQuery })
        if (searchCatId) params.set('catId', searchCatId)
        const res = await fetch(`${API_URL}/api/cats/search?${params}`, {
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        })
        if (res.ok) setSearchResults(await res.json() as SearchResult[])
      } catch { /* silent */ } finally { setSearching(false) }
    })()
  }, [searchQuery, searchCatId, getToken])

  // ── CRUD ──
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
        setAllCats((prev) => prev.filter((c) => c.id !== catId))
        setTotal((t) => t - 1)
      }
    } catch { /* silent */ } finally { setDeletingId(null); setConfirmDeleteId(null) }
  }

  function openEdit(cat: Cat) {
    setEditingCat(cat)
    setEditForm({
      numeroCat: cat.numeroCat ?? '',
      empresaContratante: cat.empresaContratante ?? '',
      tipoObraServico: cat.tipoObraServico ?? '',
      descricaoTecnica: cat.descricaoTecnica ?? '',
    })
  }

  async function handleSaveEdit() {
    if (!editingCat) return
    setSaving(true)
    try {
      const token = await getToken()
      const body: Record<string, string> = {}
      if (editForm.numeroCat.trim()) body.numeroCat = editForm.numeroCat.trim()
      if (editForm.empresaContratante.trim()) body.empresaContratante = editForm.empresaContratante.trim()
      if (editForm.tipoObraServico.trim()) body.tipoObraServico = editForm.tipoObraServico.trim()
      if (editForm.descricaoTecnica.trim()) body.descricaoTecnica = editForm.descricaoTecnica.trim()
      const res = await fetch(`${API_URL}/api/cats/${editingCat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const updated = await res.json() as Cat
        setCats((prev) => prev.map((c) => c.id === editingCat.id ? { ...c, ...updated } : c))
        setEditingCat(null)
      }
    } catch { /* silent */ } finally { setSaving(false) }
  }

  // ── Embeddings ──
  const fetchEmbStatus = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/cats/embeddings-status`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) {
        const data = await res.json() as EmbeddingStatus
        setEmbStatus(data)
        if (!data.isProcessing && embPollRef.current) {
          clearInterval(embPollRef.current)
          embPollRef.current = null
        }
      }
    } catch { /* silent */ }
  }, [getToken])

  async function handleRebuildEmbeddings() {
    setRebuilding(true); setActionMsg(null); setShowEmbPanel(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/cats/rebuild-embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: '{}',
      })
      if (res.ok) {
        const data = await res.json() as { queued: number; cats: number; catItems: number }
        setActionMsg(data.queued > 0 ? `${data.queued} embeddings enfileirados` : 'Todos os embeddings já estão gerados')
        await fetchEmbStatus()
        if (data.queued > 0) {
          if (embPollRef.current) clearInterval(embPollRef.current)
          embPollRef.current = setInterval(fetchEmbStatus, 3000)
        }
      }
    } catch { /* silent */ } finally { setRebuilding(false) }
  }

  useEffect(() => { fetchEmbStatus() }, [fetchEmbStatus])
  useEffect(() => { return () => { if (embPollRef.current) clearInterval(embPollRef.current) } }, [])

  async function handleNormalize() {
    setNormalizing(true); setActionMsg(null)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/cats/normalize-descriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: '{}',
      })
      if (res.ok) {
        const data = await res.json() as { normalized: number }
        setActionMsg(`${data.normalized} itens normalizados`)
      }
    } catch { /* silent */ } finally { setNormalizing(false) }
  }

  const confirmCat = cats.find((c) => c.id === confirmDeleteId)
  const isSearchMode = searchQuery.length >= 2
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  return (
    <div className="space-y-8">

      {/* ── Delete modal ── */}
      {confirmDeleteId && confirmCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" style={{ border: '1px solid var(--border)' }}>
            <h3 className="text-base font-semibold text-slate-900">Excluir CAT</h3>
            <p className="mt-2 text-sm text-slate-500">
              Tem certeza que deseja excluir{' '}
              <span className="font-semibold text-slate-800">{confirmCat.numeroCat ?? confirmCat.fileName}</span>?
              Esta ação é irreversível e removerá todos os itens associados.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} disabled={deletingId === confirmDeleteId}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                style={{ border: '1px solid var(--border)' }}>
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)} disabled={deletingId === confirmDeleteId}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50">
                {deletingId === confirmDeleteId && <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" style={{ border: '1px solid var(--border)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <h3 className="text-base font-semibold text-slate-900">Editar resumo da CAT</h3>
              <p className="mt-0.5 text-xs text-slate-400">{editingCat.fileName}</p>
            </div>
            <div className="space-y-4 px-6 py-5">
              {[
                { key: 'numeroCat', label: 'Número da CAT', placeholder: 'ex: 059278/2009' },
                { key: 'empresaContratante', label: 'Empresa contratante', placeholder: 'ex: SECRETARIA DE SEGURANÇA PÚBLICA' },
                { key: 'tipoObraServico', label: 'Tipo de obra/serviço', placeholder: 'ex: Construção, Reforma...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</label>
                  <input
                    type="text"
                    value={editForm[key as keyof EditForm]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003746]"
                    style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Descrição técnica</label>
                <textarea
                  value={editForm.descricaoTecnica}
                  onChange={(e) => setEditForm((f) => ({ ...f, descricaoTecnica: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003746]"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
                  placeholder="Descrição técnica detalhada..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
              <button onClick={() => setEditingCat(null)} disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                style={{ border: '1px solid var(--border)' }}>
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#003746] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#002a36] disabled:opacity-50">
                {saving && <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#003746]">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            Gestão de Acervo Técnico
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#003746]">Módulo de CATs</h1>
          <p className="mt-1 max-w-lg text-slate-600">
            Gerencie Certidões de Acervo Técnico com extração inteligente de itens e normalização automática via IA.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {actionMsg && (
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700" style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
              {actionMsg}
            </span>
          )}
          <Link href="/cats/upload/lote"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#003746] shadow-sm transition-colors hover:bg-[#e6f6ff]"
            style={{ border: '1px solid rgba(192,200,204,0.3)' }}>
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
            Upload em Lote
          </Link>
          <button onClick={handleRebuildEmbeddings} disabled={rebuilding}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#003746] shadow-sm transition-colors hover:bg-[#e6f6ff] disabled:opacity-50"
            style={{ border: '1px solid rgba(192,200,204,0.3)' }}>
            <span className={`material-symbols-outlined text-[18px] ${rebuilding ? 'animate-spin' : ''}`}>database</span>
            Rebuild Embeddings
          </button>
          <button onClick={handleNormalize} disabled={normalizing}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#003746] shadow-sm transition-colors hover:bg-[#e6f6ff] disabled:opacity-50"
            style={{ border: '1px solid rgba(192,200,204,0.3)' }}>
            <span className={`material-symbols-outlined text-[18px] ${normalizing ? 'animate-spin' : ''}`}>magic_button</span>
            Normalizar Descrições
          </button>
          <Link href="/cats/upload"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#003746] to-[#004f63] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nova CAT
          </Link>
        </div>
      </div>

      {/* ── Bento Stats ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Indexation Progress */}
        {embStatus && (showEmbPanel || embStatus.isProcessing || embStatus.doneAll < embStatus.totalAll) && (
          <div className="flex flex-col justify-between rounded-xl bg-[#e6f6ff] p-6 md:col-span-2" style={{ border: '1px solid rgba(0,55,70,0.05)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#003746]/10 text-[#003746]">
                  <span className={`material-symbols-outlined ${embStatus.isProcessing ? 'animate-spin' : ''}`}>sync</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#003746]">Status de Indexação</h3>
                  <p className="text-xs text-slate-500">Sincronizando banco vetorial (Embeddings)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#003746]/10 px-2 py-1 text-xs font-bold text-[#003746]">
                  {embStatus.progressPercent}% CONCLUÍDO
                </span>
                {!embStatus.isProcessing && (
                  <button onClick={() => setShowEmbPanel(false)} className="text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#cfe6f2]">
                <div className="h-full rounded-full bg-[#003746] transition-all duration-500" style={{ width: `${embStatus.progressPercent}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span>CATs: {embStatus.catsWithEmbedding}/{embStatus.totalCats} · Itens: {embStatus.itemsWithEmbedding}/{embStatus.totalItems}</span>
                {embStatus.isProcessing && <span>{embStatus.jobs.queued} na fila · {embStatus.jobs.running} processando</span>}
                {embStatus.jobs.failed > 0 && <span className="text-red-500">{embStatus.jobs.failed} com erro</span>}
              </div>
            </div>
          </div>
        )}
        {/* Fallback: if no emb panel, take full 2 cols with empty */}
        {!(embStatus && (showEmbPanel || embStatus.isProcessing || (embStatus.doneAll < embStatus.totalAll))) && (
          <div className="md:col-span-2" />
        )}

        {/* Acervo Total */}
        <div className="flex items-center gap-4 rounded-xl bg-white p-6 shadow-sm" style={{ border: '1px solid rgba(207,230,242,0.1)' }}>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-tighter text-slate-500">Acervo Total</p>
            <p className="text-2xl font-extrabold text-[#003746]">{loading ? '—' : total.toLocaleString('pt-BR')}</p>
          </div>
        </div>

        {/* Itens Mapeados */}
        <div className="flex items-center gap-4 rounded-xl bg-white p-6 shadow-sm" style={{ border: '1px solid rgba(207,230,242,0.1)' }}>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>precision_manufacturing</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-tighter text-slate-500">Itens Mapeados</p>
            <p className="text-2xl font-extrabold text-[#003746]">
              {embStatus ? embStatus.totalItems.toLocaleString('pt-BR') : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#003746]/60">auto_awesome</span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Busca semântica de CATs por especialidade, acervo ou palavras-chave..."
            className="w-full rounded-full bg-[#e6f6ff] py-2.5 pl-12 pr-9 text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#003746]/20"
            style={{ border: 'none' }}
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearchQuery(''); setSearchResults([]) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
        {isSearchMode && (
          <select
            value={searchCatId}
            onChange={(e) => setSearchCatId(e.target.value)}
            className="rounded-full bg-[#e6f6ff] px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#003746]/20"
          >
            <option value="">Todas as CATs</option>
            {allCats.map((c) => (
              <option key={c.id} value={c.id}>{c.numeroCat ?? c.fileName}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Content ── */}
      {isSearchMode ? (
        /* Search Results */
        <div className="overflow-hidden rounded-xl bg-white shadow-md" style={{ border: '1px solid rgba(207,230,242,0.2)' }}>
          <div className="flex items-center justify-between border-b border-[#e6f6ff] p-6">
            <span className="text-sm font-medium text-slate-500">
              {searching ? 'Buscando…' : `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''} — "${searchQuery}"${searchCatId ? ' nesta CAT' : ''}`}
            </span>
            {searching && <span className="material-symbols-outlined animate-spin text-[20px] text-[#003746]">sync</span>}
          </div>
          {searchResults.length === 0 && !searching ? (
            <div className="px-6 py-10 text-center">
              <span className="material-symbols-outlined text-[32px] text-slate-300">search_off</span>
              <p className="mt-2 text-sm text-slate-400">Nenhum item encontrado. Tente outros termos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#e6f6ff]/50">
                    <th className="border-b border-[#e6f6ff] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Descrição</th>
                    <th className="w-28 border-b border-[#e6f6ff] px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Qtd</th>
                    <th className="w-20 border-b border-[#e6f6ff] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Un</th>
                    <th className="w-64 border-b border-[#e6f6ff] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">CAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6f6ff]">
                  {searchResults.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-[#e6f6ff]/30">
                      <td className="px-6 py-4 text-sm text-slate-800">{item.descricao}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-sm text-slate-600">{fmtQty(item.quantidade)}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{item.unidade ?? '—'}</td>
                      <td className="px-6 py-4">
                        <Link href={`/cats/${item.catId}`} className="group block">
                          <div className="text-sm font-semibold text-[#003746] group-hover:underline">{item.numeroCat ?? item.fileName}</div>
                          {item.empresaContratante && <div className="max-w-[220px] truncate text-xs text-slate-400">{item.empresaContratante}</div>}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Main Table */
        <div className="overflow-hidden rounded-xl bg-white shadow-md" style={{ border: '1px solid rgba(207,230,242,0.2)' }}>
          {/* Table header */}
          <div className="flex items-center justify-between border-b border-[#e6f6ff] p-6">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-[#003746]">Listagem de Certidões</h3>
              <div className="flex items-center gap-2 rounded-lg bg-[#e6f6ff] px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-[#003746]">Extração em Tempo Real</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-lg p-2 text-slate-400 transition-colors hover:text-[#003746]">
                <span className="material-symbols-outlined">filter_list</span>
              </button>
              <button className="rounded-lg p-2 text-slate-400 transition-colors hover:text-[#003746]">
                <span className="material-symbols-outlined">download</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#e6f6ff]/50">
                  <th className="border-b border-[#e6f6ff] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">CAT / Empresa Contratante</th>
                  <th className="border-b border-[#e6f6ff] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status de Extração</th>
                  <th className="border-b border-[#e6f6ff] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Tipo de Obra</th>
                  <th className="border-b border-[#e6f6ff] px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">Itens</th>
                  <th className="border-b border-[#e6f6ff] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Data</th>
                  <th className="border-b border-[#e6f6ff] px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6f6ff]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                        <span className="material-symbols-outlined animate-spin text-[20px] text-[#003746]">sync</span>
                        Carregando…
                      </div>
                    </td>
                  </tr>
                ) : cats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center">
                      <span className="material-symbols-outlined text-[32px] text-slate-300" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      <p className="mt-2 text-sm font-medium text-slate-600">Nenhuma CAT cadastrada</p>
                      <p className="mt-0.5 text-xs text-slate-400">Cadastre certidões dos profissionais da empresa</p>
                      <Link href="/cats/upload" className="mt-3 inline-block text-sm font-semibold text-[#003746] hover:underline">
                        Cadastrar primeira CAT →
                      </Link>
                    </td>
                  </tr>
                ) : cats.map((cat) => {
                  const s = STATUS_CONFIG[cat.statusExtracao] ?? STATUS_CONFIG['pending']!
                  const isProcessing = cat.statusExtracao === 'processing'
                  return (
                    <tr key={cat.id} className="group transition-colors hover:bg-[#e6f6ff]/30">
                      <td className="px-6 py-5">
                        <div>
                          <p className="text-sm font-bold text-[#003746]">
                            {cat.numeroCat ? `#${cat.numeroCat}` : cat.fileName}
                          </p>
                          <p className="mt-0.5 max-w-[260px] truncate text-xs font-medium text-slate-500">
                            {cat.empresaContratante ?? cat.fileName}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${s.bg} ${s.text} ${s.border}`}>
                          {isProcessing ? (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#003746]" />
                          ) : cat.statusExtracao === 'error' ? (
                            <span className="material-symbols-outlined text-[12px]">error</span>
                          ) : (
                            <span className={`h-1 w-1 rounded-full ${s.dot}`} />
                          )}
                          {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {cat.tipoObraServico ? (
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            {cat.tipoObraServico}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        {cat.itemCount > 0 ? (
                          <span className="inline-flex items-center justify-center rounded-full bg-[#e6f6ff] px-2.5 py-0.5 text-xs font-bold text-[#003746]">
                            {cat.itemCount}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 tabular-nums text-xs text-slate-600">
                        {new Date(cat.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/cats/${cat.id}`}
                            className="rounded-md p-1 text-slate-400 transition-colors hover:text-[#003746]" title="Ver detalhes">
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </Link>
                          <button onClick={() => openEdit(cat)}
                            className="rounded-md p-1 text-slate-400 transition-colors hover:text-[#003746]" title="Editar">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          {cat.statusExtracao === 'error' ? (
                            <button className="rounded-md p-1 text-slate-400 transition-colors hover:text-[#003746]" title="Reprocessar">
                              <span className="material-symbols-outlined text-[20px]">refresh</span>
                            </button>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(cat.id)}
                              className="rounded-md p-1 text-slate-400 transition-colors hover:text-red-500" title="Excluir">
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-[#e6f6ff] bg-[#e6f6ff]/20 px-6 py-4">
              <p className="text-xs font-medium text-slate-500">
                Exibindo {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} de {total.toLocaleString('pt-BR')} certidões
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#d5ecf8] disabled:opacity-30">
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                {paginationRange(page, totalPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} className="px-1 text-slate-400">...</span>
                  ) : (
                    <button key={p} onClick={() => setPage(Number(p))}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                        page === p ? 'bg-[#003746] text-white shadow-sm' : 'text-slate-600 hover:bg-[#d5ecf8]'
                      }`}>
                      {p}
                    </button>
                  )
                )}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#d5ecf8] disabled:opacity-30">
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom: AI Insight + Activity ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* AI Suggestion */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#003746] to-[#004f63] p-8 text-white md:col-span-2">
          <div className="relative z-10">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#85c0d7]">
              <span className="material-symbols-outlined text-sm">tips_and_updates</span>
              Sugestão de Inteligência Artificial
            </div>
            <h4 className="mb-4 text-2xl font-bold leading-tight">
              Normalização de Descrições sugerida para {embStatus ? Math.max(embStatus.totalItems - embStatus.itemsWithEmbedding, 0) : 142} itens de acervo.
            </h4>
            <p className="max-w-lg text-sm text-[#85c0d7]">
              Identificamos duplicidades semânticas em itens de &ldquo;Terraplanagem&rdquo; e &ldquo;Pavimentação&rdquo;.
              A normalização permitirá cruzamentos mais precisos com novos editais.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <button onClick={handleNormalize} disabled={normalizing}
                className="rounded-lg bg-white px-6 py-2 text-sm font-bold text-[#003746] transition-colors hover:bg-[#85c0d7] disabled:opacity-50">
                Revisar Sugestões
              </button>
              <button className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:text-white">
                Agora Não
              </button>
            </div>
          </div>
          <div className="absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
            <span className="material-symbols-outlined text-[200px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          </div>
        </div>

        {/* Activity */}
        <div className="flex flex-col rounded-xl bg-[#d5ecf8] p-6" style={{ border: '1px solid rgba(0,55,70,0.05)' }}>
          <h4 className="mb-4 font-bold text-[#003746]">Atividade Recente</h4>
          <div className="flex-1 space-y-4">
            <ActivityDot color="bg-emerald-500" title="Upload em Lote Finalizado"
              desc="12 CATs foram processadas com sucesso." time="há 15 min" />
            <ActivityDot color="bg-[#003746]" title="Novo Profissional Vinculado"
              desc="Eng. Luana Silva adicionada ao acervo técnico." time="há 2 horas" />
            <ActivityDot color="bg-amber-500" title="Alerta de OCR"
              desc="CAT #2214 requer intervenção manual na leitura." time="Ontem às 17:30" />
          </div>
          <button className="mt-6 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#003746] hover:underline">
            Ver histórico completo
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ActivityDot({ color, title, desc, time }: { color: string; title: string; desc: string; time: string }) {
  return (
    <div className="flex gap-3">
      <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} />
      <div>
        <p className="text-xs font-bold text-[#003746]">{title}</p>
        <p className="text-[11px] text-slate-500">{desc}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{time}</p>
      </div>
    </div>
  )
}

function paginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = []
  if (current <= 3) {
    pages.push(1, 2, 3, '...', total)
  } else if (current >= total - 2) {
    pages.push(1, '...', total - 2, total - 1, total)
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total)
  }
  return pages
}
