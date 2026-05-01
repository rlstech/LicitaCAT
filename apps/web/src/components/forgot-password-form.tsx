'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage(null)

    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (result.error) {
      setStatus('error')
      setErrorMessage(result.error.message ?? 'Erro ao enviar o e-mail. Tente novamente.')
      return
    }

    setStatus('success')
  }

  if (status === 'success') {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-5 text-center">
        <p className="text-sm font-medium text-green-800">E-mail enviado!</p>
        <p className="mt-1 text-sm text-green-700">
          Se este endereço estiver cadastrado, você receberá as instruções em breve.
          Verifique também a pasta de spam.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500">
        Informe o e-mail da sua conta e enviaremos um link para redefinir sua senha.
      </p>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="seu@email.com"
        />
      </div>
      {status === 'error' && errorMessage && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMessage}</p>
      )}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Enviando...' : 'Enviar link de recuperação'}
      </button>
    </form>
  )
}
