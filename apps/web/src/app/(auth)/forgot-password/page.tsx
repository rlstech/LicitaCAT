import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Recuperar senha</h1>
        <p className="mt-2 text-sm text-slate-500">
          Lembrou a senha?{' '}
          <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
            Voltar para o login
          </Link>
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  )
}
