'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

type UploadStage = 'idle' | 'presigning' | 'uploading' | 'confirming' | 'done' | 'error'

export default function UploadEditalPage() {
    const { getToken } = useAuth()
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
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) {
            validateAndSetFile(droppedFile)
        }
    }, [])

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            validateAndSetFile(selectedFile)
        }
    }, [])

    function validateAndSetFile(f: File) {
        setErrorMessage('')
        if (f.type !== 'application/pdf') {
            setErrorMessage('Apenas arquivos PDF são permitidos.')
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
        if (!file) return

        try {
            const token = await getToken()
            const headers = {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            }

            // 1. Get presigned URL
            setStage('presigning')
            setProgress(10)

            const presignRes = await fetch(`${API_URL}/api/uploads/presign`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    fileName: file.name,
                    mimeType: file.type,
                    fileSize: file.size,
                    entityType: 'edital',
                }),
            })

            if (!presignRes.ok) {
                const err = await presignRes.json().catch(() => ({}))
                throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Erro ao gerar URL de upload')
            }

            const { presignedUrl, s3Key, entityId } = await presignRes.json() as {
                presignedUrl: string
                s3Key: string
                entityId: string
            }

            // 2. Upload to S3
            setStage('uploading')
            setProgress(30)

            const uploadRes = await fetch(presignedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type,
                },
                body: file,
            })

            if (!uploadRes.ok) {
                throw new Error('Falha no upload do arquivo para o storage')
            }

            setProgress(70)

            // 3. Confirm upload
            setStage('confirming')

            const confirmRes = await fetch(`${API_URL}/api/uploads/confirm`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    entityType: 'edital',
                    entityId,
                    s3Key,
                    fileName: file.name,
                    mimeType: file.type,
                }),
            })

            if (!confirmRes.ok) {
                const err = await confirmRes.json().catch(() => ({}))
                throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Erro ao confirmar upload')
            }

            setProgress(100)
            setStage('done')

            // Redirect after short delay
            setTimeout(() => {
                router.push('/editais')
            }, 1500)
        } catch (error) {
            setStage('error')
            setErrorMessage(
                error instanceof Error ? error.message : 'Erro desconhecido durante o upload',
            )
        }
    }

    const stageLabels: Record<UploadStage, string> = {
        idle: '',
        presigning: 'Preparando upload...',
        uploading: 'Enviando arquivo...',
        confirming: 'Processando...',
        done: 'Upload concluído! Redirecionando...',
        error: 'Erro no upload',
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Upload de Edital</h1>
                <p className="mt-1 text-gray-600">
                    Faça o upload de um edital de licitação em PDF para extração automática de requisitos.
                </p>
            </div>

            <div className="mx-auto max-w-2xl">
                {/* Drop Zone */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
            relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all duration-200
            ${isDragOver
                            ? 'border-brand-500 bg-brand-50'
                            : file
                                ? 'border-green-400 bg-green-50'
                                : 'border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50/50'
                        }
          `}
                >
                    {/* Icon */}
                    <div className={`mb-4 rounded-full p-4 ${file ? 'bg-green-100' : 'bg-brand-100'}`}>
                        <svg
                            className={`h-8 w-8 ${file ? 'text-green-600' : 'text-brand-600'}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                        >
                            {file ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            )}
                        </svg>
                    </div>

                    {file ? (
                        <div className="text-center">
                            <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                            <p className="mt-1 text-xs text-gray-500">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                            <button
                                onClick={() => { setFile(null); setStage('idle'); setErrorMessage('') }}
                                className="mt-2 text-xs text-red-600 hover:text-red-800"
                            >
                                Remover arquivo
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-700">
                                Arraste e solte o PDF aqui
                            </p>
                            <p className="mt-1 text-xs text-gray-500">ou</p>
                            <label className="mt-2 inline-block cursor-pointer rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
                                Escolher arquivo
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </label>
                            <p className="mt-2 text-xs text-gray-400">PDF, máximo 50MB</p>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {errorMessage && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <p className="text-sm text-red-700">{errorMessage}</p>
                    </div>
                )}

                {/* Progress Bar */}
                {stage !== 'idle' && stage !== 'error' && (
                    <div className="mt-6">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                                {stageLabels[stage]}
                            </span>
                            <span className="text-sm text-gray-500">{progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${stage === 'done' ? 'bg-green-500' : 'bg-brand-600'
                                    }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Upload Button */}
                {file && stage === 'idle' && (
                    <button
                        onClick={handleUpload}
                        className="mt-6 w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                    >
                        Enviar Edital para Processamento
                    </button>
                )}

                {/* Info Box */}
                <div className="mt-8 rounded-lg bg-blue-50 border border-blue-100 p-4">
                    <h3 className="text-sm font-medium text-blue-900">
                        O que acontece após o upload?
                    </h3>
                    <ol className="mt-2 list-decimal pl-5 text-xs text-blue-800 space-y-1">
                        <li>O PDF é processado por OCR para extrair o texto</li>
                        <li>A IA identifica os requisitos de qualificação técnica</li>
                        <li>Metadados como órgão, número e modalidade são extraídos</li>
                        <li>Você revisa e aprova os requisitos antes do cruzamento</li>
                    </ol>
                </div>
            </div>
        </div>
    )
}
