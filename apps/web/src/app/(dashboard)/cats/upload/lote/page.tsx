'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const MAX_FILE_SIZE = 50 * 1024 * 1024

// ── Types ─────────────────────────────────────────────────────────────────────

type FileStatus = 'pending' | 'uploading' | 'done' | 'error'

interface QueueFile {
  id: string
  file: File
  status: FileStatus
  progress: number
  error?: string
}

interface Profissional {
  id: string
  nome: string
  numeroCreaCau: string
  conselho: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UploadCatLotePage() {
  const { getToken } = useAuth()
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [selectedProfissional, setSelectedProfissional] = useState('')
  const [queue, setQueue] = useState<QueueFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchProfissionais = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/cats/profissionais`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) {
        const data = await res.json() as Profissional[]
        setProfissionais(data)
        if (data.length > 0) setSelectedProfissional(data[0]!.id)
      }
    } catch { /* silent */ }
  }, [getToken])

  useEffect(() => { fetchProfissionais() }, [fetchProfissionais])

  function addFiles(files: FileList | File[]) {
    const VALID_TYPES = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    const arr = Array.from(files)
    const valid: QueueFile[] = []
    for (const f of arr) {
      if (!VALID_TYPES.includes(f.type)) continue
      if (f.size > MAX_FILE_SIZE) continue
      if (queue.some(q => q.file.name === f.name && q.file.size === f.size)) continue
      valid.push({ id: crypto.randomUUID(), file: f, status: 'pending', progress: 0 })
    }
    setQueue(prev => [...prev, ...valid])
    setAllDone(false)
  }

  function removeFile(id: string) {
    setQueue(prev => prev.filter(q => q.id !== id))
  }

  function updateFile(id: string, patch: Partial<QueueFile>) {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
  }

  async function uploadOne(qf: QueueFile): Promise<void> {
    updateFile(qf.id, { status: 'uploading', progress: 20 })
    try {
      const token = await getToken()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const formData = new FormData()
      formData.append('entityType', 'cat')
      formData.append('profissionalId', selectedProfissional)
      formData.append('file', qf.file)
      const res = await fetch(`${API_URL}/api/uploads/file`, { method: 'POST', headers, body: formData })
      updateFile(qf.id, { progress: 90 })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Erro no upload')
      }
      updateFile(qf.id, { status: 'done', progress: 100 })
    } catch (e) {
      updateFile(qf.id, { status: 'error', progress: 0, error: e instanceof Error ? e.message : 'Erro desconhecido' })
    }
  }

  async function runQueue() {
    if (!selectedProfissional) return
    const pending = queue.filter(q => q.status === 'pending' || q.status === 'error')
    if (pending.length === 0) return
    setIsRunning(true)
    for (const qf of pending) {
      await uploadOne(qf)
    }
    setIsRunning(false)
    setAllDone(true)
  }

  const pendingCount = queue.filter(q => q.status === 'pending').length
  const errorCount   = queue.filter(q => q.status === 'error').length
  const doneCount    = queue.filter(q => q.status === 'done').length
  const canRun       = (pendingCount + errorCount) > 0 && !isRunning && !!selectedProfissional
  const noProfissionais = profissionais.length === 0

  function fileExt(f: File) {
    return f.name.split('.').pop()?.toUpperCase() ?? 'FILE'
  }

  return (
    <div className="max-w-2xl pb-12">

      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/cats" className="transition-colors hover:text-slate-700">CATs</Link>
          <span>/</span>
          <Link href="/cats/upload" className="transition-colors hover:text-slate-700">Upload</Link>
          <span>/</span>
          <span className="text-slate-600">Lote</span>
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">Upload em lote — CATs</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Selecione múltiplos arquivos PDF ou Excel para enviar de uma vez.
        </p>
      </div>

      {/* ── Profissional selector ── */}
      <div
        className="mb-5 overflow-hidden rounded-xl bg-white"
        style={{ border: '1px solid var(--border)' }}
      >
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Profissional Responsável</p>
          <p className="mt-0.5 text-xs text-slate-500">Será vinculado a todos os arquivos do lote.</p>
        </div>

        {noProfissionais ? (
          <div className="px-5 py-4" style={{ borderLeft: '3px solid #d97706', backgroundColor: 'rgba(251,191,36,0.05)' }}>
            <p className="text-sm text-amber-800">
              Nenhum profissional cadastrado.{' '}
              <Link href="/cats/profissionais" className="font-semibold underline decoration-amber-400 hover:text-amber-900">
                Cadastre primeiro
              </Link>.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {profissionais.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProfissional(p.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  selectedProfissional === p.id ? 'bg-brand-50' : 'hover:bg-slate-50'
                }`}
                style={{
                  border: `1px solid ${selectedProfissional === p.id ? 'rgba(124,58,237,0.3)' : 'var(--border)'}`,
                }}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    backgroundColor: selectedProfissional === p.id ? 'rgba(124,58,237,0.15)' : 'rgba(15,23,42,0.06)',
                    color: selectedProfissional === p.id ? '#7c3aed' : '#64748b',
                  }}
                >
                  {p.nome.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className={`text-xs font-medium leading-none ${selectedProfissional === p.id ? 'text-brand-900' : 'text-slate-800'}`}>
                    {p.nome}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{p.conselho} · {p.numeroCreaCau}</p>
                </div>
                {selectedProfissional === p.id && (
                  <svg className="h-3.5 w-3.5 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Drop zone ── */}
      {!allDone && !noProfissionais && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false) }}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl p-10 transition-all duration-200"
          style={{
            border: `2px dashed ${isDragOver ? '#0e7490' : 'var(--border-strong)'}`,
            backgroundColor: isDragOver ? 'rgba(14,116,144,0.04)' : 'var(--canvas)',
          }}
        >
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'rgba(14,116,144,0.1)' }}
          >
            <svg className="h-6 w-6 text-cyan-700" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">Arraste os arquivos aqui ou clique para selecionar</p>
          <p className="mt-1 text-xs text-slate-400">Múltiplos arquivos · PDF ou Excel · máx 50 MB cada</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.xls,.xlsx"
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files) }}
          />
        </div>
      )}

      {/* ── Fila ── */}
      {queue.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white" style={{ border: '1px solid var(--border)' }}>
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid var(--border-soft)', backgroundColor: 'var(--canvas)' }}
          >
            <p className="text-xs font-semibold text-slate-600">
              {queue.length} arquivo{queue.length !== 1 ? 's' : ''}
              {doneCount > 0 && <span className="ml-2 text-green-600">· {doneCount} concluído{doneCount !== 1 ? 's' : ''}</span>}
              {errorCount > 0 && <span className="ml-2 text-red-500">· {errorCount} com erro</span>}
            </p>
            {!isRunning && !allDone && (
              <button
                onClick={() => setQueue([])}
                className="text-xs text-slate-400 transition-colors hover:text-slate-600"
              >
                Limpar tudo
              </button>
            )}
          </div>

          <ul>
            {queue.map((qf, idx) => (
              <li
                key={qf.id}
                className="flex items-center gap-3 px-5 py-3"
                style={{ borderTop: idx > 0 ? '1px solid var(--border-soft)' : 'none' }}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {qf.status === 'done' && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
                      <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                  {qf.status === 'error' && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
                      <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  {qf.status === 'uploading' && (
                    <div className="flex h-7 w-7 items-center justify-center">
                      <svg className="h-5 w-5 animate-spin text-cyan-600" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                  {qf.status === 'pending' && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{qf.file.name}</p>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
                      style={{ backgroundColor: 'var(--canvas)' }}
                    >
                      {fileExt(qf.file)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-slate-400">{(qf.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                    {qf.status === 'error' && qf.error && <span className="text-xs text-red-500">{qf.error}</span>}
                    {qf.status === 'done' && <span className="text-xs text-green-600">Enviado com sucesso</span>}
                    {qf.status === 'uploading' && <span className="text-xs text-cyan-600">{qf.progress}%</span>}
                  </div>
                  {qf.status === 'uploading' && (
                    <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                        style={{ width: `${qf.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {(qf.status === 'pending' || qf.status === 'error') && !isRunning && (
                  <button
                    onClick={() => removeFile(qf.id)}
                    className="shrink-0 rounded p-1 text-slate-300 transition-colors hover:text-slate-500"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Sucesso total ── */}
      {allDone && errorCount === 0 && (
        <div
          className="mt-4 rounded-xl px-5 py-4"
          style={{ border: '1px solid rgba(22,163,74,0.2)', borderLeft: '3px solid #16a34a', backgroundColor: 'rgba(240,253,244,0.8)' }}
        >
          <p className="text-sm font-semibold text-green-800">
            {doneCount} CAT{doneCount !== 1 ? 's enviadas' : ' enviada'} com sucesso!
          </p>
          <p className="mt-0.5 text-xs text-green-700">
            A extração de dados será realizada automaticamente em segundo plano.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/cats"
              className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
            >
              Ver CATs
            </Link>
            <button
              onClick={() => { setQueue([]); setAllDone(false) }}
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
              style={{ border: '1px solid rgba(22,163,74,0.2)' }}
            >
              Enviar mais
            </button>
          </div>
        </div>
      )}

      {/* ── Botão principal ── */}
      {queue.length > 0 && !allDone && !noProfissionais && (
        <button
          onClick={runQueue}
          disabled={!canRun}
          className="mt-5 w-full rounded-xl px-6 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#0e7490' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#155e75')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0e7490')}
        >
          {isRunning
            ? `Enviando… (${doneCount}/${queue.length})`
            : errorCount > 0
            ? `Tentar novamente (${errorCount} com erro)`
            : `Enviar ${pendingCount} CAT${pendingCount !== 1 ? 's' : ''}`}
        </button>
      )}

      {/* ── Link individual ── */}
      <p className="mt-6 text-center text-xs text-slate-400">
        Prefere enviar uma por vez?{' '}
        <Link href="/cats/upload" className="font-medium text-cyan-700 hover:text-cyan-800">
          Upload individual
        </Link>
      </p>
    </div>
  )
}
