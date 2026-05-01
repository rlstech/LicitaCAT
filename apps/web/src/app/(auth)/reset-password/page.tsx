import { Suspense } from 'react'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/reset-password-form'

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Nova senha</h1>
        <p className="mt-2 text-sm text-slate-500">
          Lembrou a senha?{' '}
          <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
            Voltar para o login
          </Link>
        </p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-slate-100" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
