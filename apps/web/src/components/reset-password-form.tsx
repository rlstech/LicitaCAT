'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-5 text-center">
        <p className="text-sm font-medium text-red-800">Link inválido ou expirado</p>
        <p className="mt-1 text-sm text-red-700">Solicite um novo link de recuperação de senha.</p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (newPassword !== confirm) {
      setErrorMessage('As senhas não conferem.')
      return
    }
    if (newPassword.length < 8) {
      setErrorMessage('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setStatus('loading')

    const result = await authClient.resetPassword({ newPassword, token: token! })

    if (result.error) {
      setStatus('error')
      setErrorMessage(
        result.error.code === 'INVALID_TOKEN'
          ? 'Este link expirou ou já foi utilizado. Solicite um novo.'
          : (result.error.message ?? 'Erro ao redefinir a senha. Tente novamente.'),
      )
      return
    }

    setStatus('success')
    setTimeout(() => router.push('/sign-in'), 2000)
  }

  if (status === 'success') {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-5 text-center">
        <p className="text-sm font-medium text-green-800">Senha redefinida com sucesso!</p>
        <p className="mt-1 text-sm text-green-700">Redirecionando para o login...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1">
          Nova senha
        </label>
        <input
          id="newPassword"
          type="password"
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="mínimo 8 caracteres"
        />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1">
          Confirmar nova senha
        </label>
        <input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="••••••••"
        />
      </div>
      {(status === 'error' || errorMessage) && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMessage}</p>
      )}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Salvando...' : 'Redefinir senha'}
      </button>
    </form>
  )
}
