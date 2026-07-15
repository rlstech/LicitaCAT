'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useToken } from '@/hooks/use-token'

function exportToCsv(editais: { fileName: string; orgaoLicitante: string | null; numeroEdital: string | null; objeto: string | null; status: string; valorEstimado: string | null; dataAbertura: string | null }[]) {
  const header = ['Nº Edital', 'Órgão Licitante', 'Objeto', 'Status', 'Valor Estimado', 'Data Abertura', 'Arquivo']
  const rows = editais.map((e) => [
    e.numeroEdital ?? '',
    e.orgaoLicitante ?? '',
    e.objeto ?? '',
    e.status,
    e.valorEstimado ?? '',
    e.dataAbertura ? new Date(e.dataAbertura).toLocaleDateString('pt-BR') : '',
    e.fileName,
  ])
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `editais_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Edital {
  id: string
  fileName: string
  orgaoLicitante: string | null
  numeroEdital: string | null
  objeto: string | null
  status: string
  createdAt: string
  pageCount: number | null
  valorEstimado: string | null
  dataAbertura: string | null
}

interface EditaisResponse {
  data: Edital[]
  total: number
  page: number
  limit: number
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  uploaded:        { label: 'Na fila',              dot: 'bg-slate-500',   bg: 'bg-slate-100',   text: 'text-slate-800' },
  ocr_processing:  { label: 'OCR em andamento',     dot: 'bg-blue-500',    bg: 'bg-blue-100',    text: 'text-blue-800' },
  extracting:      { label: 'Extraindo',            dot: 'bg-cyan-500',    bg: 'bg-cyan-100',    text: 'text-cyan-800' },
  review_pending:  { label: 'Aguardando Revisão',   dot: 'bg-amber-500',   bg: 'bg-amber-100',   text: 'text-amber-800' },
  ready:           { label: 'Pronto',               dot: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  error:           { label: 'Erro',                 dot: 'bg-red-500',     bg: 'bg-red-100',     text: 'text-red-800' },
}

const PROCESSING_STATUSES = ['ocr_processing', 'extracting']
const ITEMS_PER_PAGE = 20

export default function EditaisPage() {
  const getToken = useToken()
  const [editais, setEditais] = useState<Edital[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchEditais = useCallback(async () => {
    try {
      const token = await getToken()
      const params = new URLSearchParams({ page: String(page), limit: String(ITEMS_PER_PAGE) })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`${API_URL}/api/editais?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (res.ok) {
        const data = (await res.json()) as EditaisResponse
        setEditais(data.data)
        setTotal(data.total)
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getToken, page, statusFilter])

  useEffect(() => {
    fetchEditais()
    const interval = setInterval(fetchEditais, 10000)
    return () => clearInterval(interval)
  }, [fetchEditais])

  async function deleteEdital(editalId: string) {
    setDeletingId(editalId)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/editais/${editalId}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) {
        setEditais((prev) => prev.filter((e) => e.id !== editalId))
        setTotal((prev) => prev - 1)
      }
    } catch { /* silent */ } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  function formatDateShort(dateStr: string | null): string {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function formatBRL(val: string | null): string {
    if (!val) return '—'
    return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)
  const reviewCount = editais.filter((e) => e.status === 'review_pending').length

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#003746]">Módulo de Editais</h1>
          <p className="mt-1 text-sm text-[#4c626a]">Gerencie, processe e analise editais de engenharia em tempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/editais/buscar-pncp"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#003746] shadow-sm transition-all hover:bg-[#e6f6ff]"
            style={{ border: '1px solid rgba(192,200,204,0.3)' }}
          >
            <span className="material-symbols-outlined text-[18px]">travel_explore</span>
            Buscar no PNCP
          </Link>
          <Link
            href="/editais/upload"
            className="inline-flex items-center gap-2 rounded-lg bg-[#003746] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004f63]"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Novo Edital
          </Link>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl bg-white p-4 shadow-sm" style={{ border: '1px solid rgba(207,230,242,0.1)' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Processado</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tighter text-[#003746]">{loading ? '—' : total.toLocaleString('pt-BR')}</span>
            {total > 0 && <span className="text-xs font-medium text-emerald-600">editais</span>}
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl bg-white p-4 shadow-sm" style={{ border: '1px solid rgba(207,230,242,0.1)' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aguardando Revisão</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tighter text-[#003746]">{loading ? '—' : reviewCount}</span>
            {reviewCount > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
          </div>
        </div>
        <div className="group relative col-span-1 overflow-hidden rounded-xl bg-[#003746] p-4 text-white shadow-md md:col-span-2">
          <div className="relative z-10 flex h-full flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#85c0d7]">Capacidade de OCR</span>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold tracking-tighter">98.2%</span>
                <p className="text-[10px] text-[#85c0d7]">Precisão média na extração</p>
              </div>
              <span className="material-symbols-outlined text-4xl text-[#85c0d7]/30">analytics</span>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-[#004f63] opacity-50 blur-2xl transition-all group-hover:scale-150" />
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm" style={{ border: '1px solid rgba(207,230,242,0.1)' }}>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-4 border-b border-[#e6f6ff] bg-white p-4">
          <div className="relative min-w-[200px] flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">filter_list</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full appearance-none rounded-lg border-none bg-[#e6f6ff] py-1.5 pl-9 pr-4 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#004f63]"
            >
              <option value="">Todos os Status</option>
              <option value="uploaded">Na fila</option>
              <option value="ocr_processing">OCR em andamento</option>
              <option value="extracting">Extraindo</option>
              <option value="review_pending">Aguardando Revisão</option>
              <option value="ready">Pronto</option>
              <option value="error">Erro</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCsv(editais)}
              disabled={editais.length === 0}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-[#003746] disabled:opacity-30"
              title="Exportar lista como CSV"
            >
              <span className="material-symbols-outlined text-xl">download</span>
            </button>
          </div>
        </div>

        {/* Dense Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#e6f6ff]/50">
                <th className="border-b border-[#e6f6ff] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#4c626a]">Edital</th>
                <th className="border-b border-[#e6f6ff] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#4c626a]">Órgão Licitante</th>
                <th className="border-b border-[#e6f6ff] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#4c626a]">Status</th>
                <th className="border-b border-[#e6f6ff] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#4c626a]">Valor Estimado</th>
                <th className="border-b border-[#e6f6ff] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#4c626a]">Data Abertura</th>
                <th className="border-b border-[#e6f6ff] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-[#4c626a]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6f6ff]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                      <span className="material-symbols-outlined animate-spin text-[20px] text-brand-500">sync</span>
                      Carregando…
                    </div>
                  </td>
                </tr>
              ) : editais.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <span className="material-symbols-outlined text-[32px] text-slate-300">description</span>
                    <p className="mt-2 text-sm font-medium text-slate-600">Nenhum edital encontrado</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {statusFilter ? 'Tente outro filtro de status' : 'Faça upload de um PDF para começar'}
                    </p>
                    {!statusFilter && (
                      <Link href="/editais/upload" className="mt-3 inline-block text-sm font-semibold text-[#003746] hover:underline">
                        Upload do primeiro edital →
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                editais.map((edital) => {
                  const s = STATUS_CONFIG[edital.status] ?? STATUS_CONFIG['uploaded']!
                  const isProcessing = PROCESSING_STATUSES.includes(edital.status)
                  return (
                    <tr key={edital.id} className="group transition-colors hover:bg-[#e6f6ff]/30">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#003746]">
                            {edital.numeroEdital ?? edital.fileName}
                          </span>
                          {edital.objeto && (
                            <span className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                              {edital.objeto}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <span className="block truncate text-xs font-medium text-slate-700">
                          {edital.orgaoLicitante ?? '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.bg} ${s.text}`}>
                          {isProcessing ? (
                            <span className="material-symbols-outlined animate-spin text-[12px]">sync</span>
                          ) : (
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          )}
                          {s.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-xs font-medium text-slate-700">{formatBRL(edital.valorEstimado)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-xs text-slate-600">{formatDateShort(edital.dataAbertura)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {edital.status === 'error' ? (
                            <>
                              <button
                                className="rounded-md p-1 text-[#003746] transition-colors hover:bg-[#003746]/10"
                                title="Reprocessar"
                              >
                                <span className="material-symbols-outlined text-lg">refresh</span>
                              </button>
                              {renderDeleteButton(edital.id)}
                            </>
                          ) : edital.status === 'review_pending' ? (
                            <>
                              <Link
                                href={`/editais/${edital.id}`}
                                className="rounded-md p-1 text-[#003746] transition-colors hover:bg-[#003746]/10"
                                title="Revisar"
                              >
                                <span className="material-symbols-outlined text-lg">edit_note</span>
                              </Link>
                              {renderDeleteButton(edital.id)}
                            </>
                          ) : isProcessing ? (
                            <span className="p-1 text-slate-300">
                              <span className="material-symbols-outlined text-lg">
                                {edital.status === 'ocr_processing' ? 'sync' : 'hourglass_top'}
                              </span>
                            </span>
                          ) : edital.status === 'ready' ? (
                            <>
                              <Link
                                href={`/editais/${edital.id}`}
                                className="rounded-md p-1 text-[#003746] transition-colors hover:bg-[#003746]/10"
                                title="Ver detalhes e requisitos"
                              >
                                <span className="material-symbols-outlined text-lg">visibility</span>
                              </Link>
                              {renderDeleteButton(edital.id)}
                            </>
                          ) : (
                            renderDeleteButton(edital.id)
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {total > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between border-t border-[#e6f6ff] bg-[#e6f6ff]/20 px-4 py-3">
            <span className="text-[11px] font-medium text-slate-500">
              Exibindo {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} de {total.toLocaleString('pt-BR')} editais
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#d5ecf8] disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              {paginationRange(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} className="px-1 text-slate-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(Number(p))}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                      page === p
                        ? 'bg-[#003746] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-[#d5ecf8]'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#d5ecf8] disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Section: Dica + Drop zone ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex items-start gap-4 rounded-xl bg-white p-6 md:col-span-2" style={{ border: '1px solid var(--border)' }}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#cfe6f2] text-[#003746]">
            <span className="material-symbols-outlined text-3xl">lightbulb</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#003746] mb-1">Dica de Produtividade</h3>
            <p className="text-xs leading-relaxed text-[#4c626a]">
              Você pode automatizar o cruzamento de CATs profissionais assim que um edital for marcado como &ldquo;Pronto&rdquo;.
              Ative as regras de automação nas configurações do seu perfil.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#cfe6f2] bg-[#cfe6f2]/30 p-6 text-center">
          <span className="material-symbols-outlined mb-2 text-4xl text-slate-300">cloud_upload</span>
          <p className="text-xs font-semibold text-[#003746]">Arraste novos editais aqui</p>
          <p className="mt-1 text-[10px] text-slate-400">PDF até 50MB</p>
        </div>
      </div>
    </div>
  )

  function renderDeleteButton(editalId: string) {
    if (confirmDeleteId === editalId) {
      return (
        <span className="flex items-center gap-1.5">
          <button
            onClick={() => deleteEdital(editalId)}
            disabled={deletingId === editalId}
            className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {deletingId === editalId ? '…' : 'Sim'}
          </button>
          <button
            onClick={() => setConfirmDeleteId(null)}
            className="text-[10px] font-medium text-slate-400 hover:text-slate-600"
          >
            Não
          </button>
        </span>
      )
    }
    return (
      <button
        onClick={() => setConfirmDeleteId(editalId)}
        className="rounded-md p-1 text-slate-400 transition-colors hover:text-red-500"
        title="Excluir"
      >
        <span className="material-symbols-outlined text-lg">delete</span>
      </button>
    )
  }
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
