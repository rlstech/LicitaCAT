'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToken } from '@/hooks/use-token'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const MAX_FILE_SIZE = 50 * 1024 * 1024

interface Profissional {
  id: string
  nome: string
  numeroCreaCau: string
  conselho: string
}

type UploadStage = 'idle' | 'presigning' | 'uploading' | 'confirming' | 'done' | 'error'

export default function UploadCatPage() {
  const getToken = useToken()
  const router = useRouter()

  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [selectedProfissional, setSelectedProfissional] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<UploadStage>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  const fetchProfissionais = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/cats/profissionais`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (res.ok) {
        const data = await res.json() as Profissional[]
        setProfissionais(data)
        if (data.length > 0 && !selectedProfissional) setSelectedProfissional(data[0]!.id)
      }
    } catch { /* silent */ }
  }, [getToken, selectedProfissional])

  useEffect(() => { fetchProfissionais() }, [fetchProfissionais])

  function validateAndSetFile(f: File) {
    setErrorMessage('')
    const validTypes = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!validTypes.includes(f.type)) {
      setErrorMessage('Apenas PDF e Excel (.xls, .xlsx) são permitidos.')
      return
    }
    if (f.size > MAX_FILE_SIZE) {
      setErrorMessage('Arquivo excede o tamanho máximo de 50 MB.')
      return
    }
    setFile(f)
    setStage('idle')
  }

  async function handleUpload() {
    if (!file || !selectedProfissional) return
    try {
      const token = await getToken()
      const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      setStage('uploading')
      setProgress(20)

      const formData = new FormData()
      formData.append('entityType', 'cat')
      formData.append('profissionalId', selectedProfissional)
      formData.append('file', file)

      const res = await fetch(`${API_URL}/api/uploads/file`, {
        method: 'POST',
        headers: authHeader,
        body: formData,
      })

      setProgress(80)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Erro no upload')
      }

      setProgress(100)
      setStage('done')
      setTimeout(() => router.push('/cats'), 1500)
    } catch (error) {
      setStage('error')
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido')
    }
  }

  const stageLabels: Record<UploadStage, string> = {
    idle: '', presigning: '', uploading: 'Enviando arquivo…', confirming: '', done: 'Concluído! Redirecionando…', error: '',
  }

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(2) : ''
  const fileExt = file ? file.name.split('.').pop()?.toUpperCase() ?? '' : ''
  const isPdf = file?.type === 'application/pdf'
  const noProfissionais = profissionais.length === 0

  return (
    <div className="max-w-2xl pb-12">

      {/* ── Header ── */}
      <div className="mb-6">
        <Link href="/cats" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          CATs
        </Link>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">Upload de CAT</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Envie uma Certidão de Acervo Técnico para extração automática de dados e itens.
        </p>
      </div>

      {/* ── Profissional selector ── */}
      <div
        className="mb-5 overflow-hidden rounded-xl bg-white"
        style={{ border: '1px solid var(--border)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Profissional Responsável</p>
        </div>

        {noProfissionais ? (
          <div
            className="rounded-lg px-5 py-4"
            style={{ border: '1px solid rgba(217,119,6,0.25)', backgroundColor: 'rgba(254,243,199,0.5)' }}
          >
            <p className="text-sm text-amber-800">
              Nenhum profissional cadastrado.{' '}
              <Link href="/cats/profissionais" className="font-semibold underline decoration-amber-400 hover:text-amber-900">
                Cadastre primeiro
              </Link>{' '}
              antes de fazer o upload de uma CAT.
            </p>
          </div>
        ) : (
          <div className="px-5 py-4">
            <div className="flex flex-col gap-2">
              {profissionais.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProfissional(p.id)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-colors ${
                    selectedProfissional === p.id ? 'bg-brand-50' : 'hover:bg-slate-50'
                  }`}
                  style={{
                    border: `1px solid ${selectedProfissional === p.id ? 'rgba(124,58,237,0.25)' : 'var(--border-soft)'}`,
                  }}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      backgroundColor: selectedProfissional === p.id ? 'rgba(124,58,237,0.15)' : 'rgba(15,23,42,0.06)',
                      color: selectedProfissional === p.id ? '#7c3aed' : '#64748b',
                    }}
                  >
                    {p.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${selectedProfissional === p.id ? 'text-brand-900' : 'text-slate-800'}`}>
                      {p.nome}
                    </p>
                    <p className="text-xs text-slate-400">{p.conselho} · {p.numeroCreaCau}</p>
                  </div>
                  {selectedProfissional === p.id && (
                    <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Drop zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false) }}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) validateAndSetFile(f) }}
        className="relative flex flex-col items-center justify-center rounded-xl p-12 transition-all duration-200 cursor-default"
        style={{
          border: `2px dashed ${
            isDragOver ? '#7c3aed'
            : file && stage !== 'error' ? '#16a34a'
            : 'var(--border-strong)'
          }`,
          backgroundColor: isDragOver
            ? 'rgba(124,58,237,0.04)'
            : file && stage !== 'error'
            ? 'rgba(22,163,74,0.04)'
            : 'var(--canvas)',
        }}
      >
        {/* Icon */}
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: file && stage !== 'error'
              ? 'rgba(22,163,74,0.1)'
              : 'rgba(14,116,144,0.1)',
          }}
        >
          <svg
            className="h-7 w-7"
            style={{ color: file && stage !== 'error' ? '#16a34a' : '#0e7490' }}
            fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"
          >
            {file && stage !== 'error' ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : isPdf ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125v-5.625M6 18.375V8.25M6 8.25H3.375m2.625 0A1.125 1.125 0 006 7.125M6 7.125V5.25m0-3H5.625a1.125 1.125 0 00-1.125 1.125v.75M6 2.25A1.125 1.125 0 007.125 3.375M7.125 3.375H9M9 3.375v13.5" />
            )}
          </svg>
        </div>

        {file && stage !== 'error' ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">{file.name}</p>
            <p className="mt-1 text-xs text-slate-500">{fileSizeMB} MB · {fileExt}</p>
            <button
              onClick={() => { setFile(null); setStage('idle'); setErrorMessage('') }}
              className="mt-2.5 text-xs text-slate-400 transition-colors hover:text-red-500"
            >
              Remover arquivo
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">Arraste e solte o arquivo aqui</p>
            <p className="mt-1 text-xs text-slate-400">ou</p>
            <label className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Escolher arquivo
              <input
                type="file"
                accept=".pdf,.xls,.xlsx"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f) }}
                className="hidden"
              />
            </label>
            <p className="mt-2 text-xs text-slate-400">PDF ou Excel · máximo 50 MB</p>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {errorMessage && (
        <div
          className="mt-3 rounded-lg px-4 py-3"
          style={{ border: '1px solid rgba(220,38,38,0.25)', backgroundColor: 'rgba(254,242,242,0.7)' }}
        >
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* ── Progress ── */}
      {stage !== 'idle' && stage !== 'error' && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">{stageLabels[stage]}</span>
            <span className="text-xs tabular-nums text-slate-400">{progress}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--canvas)' }}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${stage === 'done' ? 'bg-green-500' : 'bg-brand-600'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {stage === 'done' && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Upload concluído — redirecionando…
            </p>
          )}
        </div>
      )}

      {/* ── Upload button ── */}
      {file && stage === 'idle' && selectedProfissional && (
        <button
          onClick={handleUpload}
          className="mt-5 w-full rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none"
        >
          Enviar CAT para processamento
        </button>
      )}

      {/* ── Link para lote ── */}
      <p className="mt-4 text-center text-xs text-slate-400">
        Tem várias CATs?{' '}
        <Link href="/cats/upload/lote" className="font-medium text-cyan-700 hover:text-cyan-800">
          Upload em lote
        </Link>
      </p>

      {/* ── Info card ── */}
      <div
        className="mt-8 rounded-xl p-5"
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--canvas)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">O que acontece após o upload?</h3>
        <ol className="mt-3 space-y-2.5">
          {[
            'PDF: OCR extrai o texto da certidão; Excel: planilha é lida diretamente',
            'A IA identifica dados como empresa contratante, tipo de obra e período',
            'Os itens técnicos (quantitativos, serviços) são extraídos automaticamente',
            'Você revisa e aprova os dados antes de usar a CAT em cruzamentos',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-cyan-700"
                style={{ backgroundColor: 'rgba(14,116,144,0.1)' }}
              >
                {i + 1}
              </span>
              <span className="text-xs text-slate-600 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
