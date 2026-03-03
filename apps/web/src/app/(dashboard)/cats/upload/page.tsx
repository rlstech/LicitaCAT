'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
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
    const { getToken } = useAuth()
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
            setErrorMessage('Arquivo excede o tamanho máximo de 50MB.')
            return
        }
        setFile(f)
        setStage('idle')
    }

    async function handleUpload() {
        if (!file || !selectedProfissional) return

        try {
            const token = await getToken()
            const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }

            setStage('presigning')
            setProgress(10)

            const presignRes = await fetch(`${API_URL}/api/uploads/presign`, {
                method: 'POST', headers,
                body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size, entityType: 'cat' }),
            })
            if (!presignRes.ok) {
                const err = await presignRes.json().catch(() => ({}))
                throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Erro ao gerar URL')
            }
            const { presignedUrl, s3Key, entityId } = await presignRes.json() as { presignedUrl: string; s3Key: string; entityId: string }

            setStage('uploading')
            setProgress(30)

            const uploadRes = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
            if (!uploadRes.ok) throw new Error('Falha no upload')
            setProgress(70)

            setStage('confirming')
            const confirmRes = await fetch(`${API_URL}/api/uploads/confirm`, {
                method: 'POST', headers,
                body: JSON.stringify({ entityType: 'cat', entityId, s3Key, fileName: file.name, mimeType: file.type, profissionalId: selectedProfissional }),
            })
            if (!confirmRes.ok) {
                const err = await confirmRes.json().catch(() => ({}))
                throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Erro ao confirmar')
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
        idle: '', presigning: 'Preparando...', uploading: 'Enviando...', confirming: 'Processando...', done: 'Concluído! Redirecionando...', error: 'Erro',
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Upload de CAT</h1>
                <p className="mt-1 text-gray-600">Envie uma Certidão de Acervo Técnico para extração automática.</p>
            </div>

            <div className="mx-auto max-w-2xl">
                {/* Profissional Selector */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700">Profissional Responsável</label>
                    {profissionais.length === 0 ? (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm text-amber-800">
                                Nenhum profissional cadastrado.{' '}
                                <Link href="/cats/profissionais" className="font-medium underline hover:text-amber-900">Cadastre primeiro</Link>.
                            </p>
                        </div>
                    ) : (
                        <select
                            value={selectedProfissional}
                            onChange={(e) => setSelectedProfissional(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                            {profissionais.map((p) => (
                                <option key={p.id} value={p.id}>{p.nome} — {p.conselho} {p.numeroCreaCau}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Drop Zone */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false) }}
                    onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) validateAndSetFile(f) }}
                    className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all duration-200 ${isDragOver ? 'border-brand-500 bg-brand-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-brand-400'
                        }`}
                >
                    <div className={`mb-4 rounded-full p-4 ${file ? 'bg-green-100' : 'bg-brand-100'}`}>
                        <svg className={`h-8 w-8 ${file ? 'text-green-600' : 'text-brand-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            {file
                                ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                : <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />}
                        </svg>
                    </div>
                    {file ? (
                        <div className="text-center">
                            <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                            <p className="mt-1 text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            <button onClick={() => { setFile(null); setStage('idle'); setErrorMessage('') }} className="mt-2 text-xs text-red-600 hover:text-red-800">Remover</button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-700">Arraste e solte o arquivo aqui</p>
                            <p className="mt-1 text-xs text-gray-500">ou</p>
                            <label className="mt-2 inline-block cursor-pointer rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
                                Escolher arquivo
                                <input type="file" accept=".pdf,.xls,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f) }} className="hidden" />
                            </label>
                            <p className="mt-2 text-xs text-gray-400">PDF ou Excel, máximo 50MB</p>
                        </div>
                    )}
                </div>

                {errorMessage && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <p className="text-sm text-red-700">{errorMessage}</p>
                    </div>
                )}

                {stage !== 'idle' && stage !== 'error' && (
                    <div className="mt-6">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">{stageLabels[stage]}</span>
                            <span className="text-sm text-gray-500">{progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                            <div className={`h-full rounded-full transition-all duration-500 ${stage === 'done' ? 'bg-green-500' : 'bg-brand-600'}`} style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}

                {file && stage === 'idle' && selectedProfissional && (
                    <button onClick={handleUpload} className="mt-6 w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors">
                        Enviar CAT para Processamento
                    </button>
                )}
            </div>
        </div>
    )
}
