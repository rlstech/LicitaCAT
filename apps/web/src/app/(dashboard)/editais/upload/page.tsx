'use client'

import { useState, useCallback } from 'react'
import { useToken } from '@/hooks/use-token'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const MAX_FILE_SIZE = 50 * 1024 * 1024

type UploadStage = 'idle' | 'presigning' | 'uploading' | 'confirming' | 'done' | 'error'

export default function UploadEditalPage() {
  const getToken = useToken()
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<UploadStage>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) validateAndSetFile(f)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) validateAndSetFile(f)
  }, [])

  function validateAndSetFile(f: File) {
    setErrorMessage('')
    if (f.type !== 'application/pdf') {
      setErrorMessage('Apenas arquivos PDF são permitidos.')
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
    if (!file) return
    try {
      const token = await getToken()
      const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      setStage('uploading')
      setProgress(20)

      const formData = new FormData()
      formData.append('entityType', 'edital')
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
      setTimeout(() => router.push('/editais'), 1500)
    } catch (error) {
      setStage('error')
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido durante o upload')
    }
  }

  const stageLabels: Record<UploadStage, string> = {
    idle: '', presigning: '', uploading: 'Enviando arquivo…', confirming: '', done: 'Concluído! Redirecionando…', error: '',
  }

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(2) : ''

  return (
    <div className="max-w-2xl pb-12">

      {/* ── Header ── */}
      <div className="mb-6">
        <Link href="/editais" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Editais
        </Link>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">Upload de Edital</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Envie um edital de licitação em PDF para extração automática de requisitos de qualificação técnica.
        </p>
      </div>

      {/* ── Drop zone ── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
              : 'rgba(124,58,237,0.1)',
          }}
        >
          <svg
            className="h-7 w-7"
            style={{ color: file && stage !== 'error' ? '#16a34a' : '#7c3aed' }}
            fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"
          >
            {file && stage !== 'error' ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            )}
          </svg>
        </div>

        {file && stage !== 'error' ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">{file.name}</p>
            <p className="mt-1 text-xs text-slate-500">{fileSizeMB} MB · PDF</p>
            <button
              onClick={() => { setFile(null); setStage('idle'); setErrorMessage('') }}
              className="mt-2.5 text-xs text-slate-400 transition-colors hover:text-red-500"
            >
              Remover arquivo
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">Arraste e solte o PDF aqui</p>
            <p className="mt-1 text-xs text-slate-400">ou</p>
            <label className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Escolher arquivo
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            <p className="mt-2 text-xs text-slate-400">PDF · máximo 50 MB</p>
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
      {file && stage === 'idle' && (
        <button
          onClick={handleUpload}
          className="mt-5 w-full rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none"
        >
          Enviar para processamento
        </button>
      )}

      {/* ── Link para lote ── */}
      <p className="mt-4 text-center text-xs text-slate-400">
        Tem vários PDFs?{' '}
        <Link href="/editais/upload/lote" className="font-medium text-brand-600 hover:text-brand-700">
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
            'O PDF é processado por OCR para extrair o texto completo',
            'A IA identifica os requisitos de qualificação técnica exigidos',
            'Metadados como órgão, número e modalidade são extraídos automaticamente',
            'Você revisa e aprova os requisitos antes de iniciar um cruzamento',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-brand-700"
                style={{ backgroundColor: 'rgba(124,58,237,0.1)' }}
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
