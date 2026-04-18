import Link from 'next/link'
import { SignInForm } from '@/components/sign-in-form'

export default function SignInPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Entrar na sua conta</h1>
        <p className="mt-2 text-sm text-slate-500">
          Não tem conta?{' '}
          <Link href="/sign-up" className="font-medium text-brand-600 hover:text-brand-700">
            Cadastre-se
          </Link>
        </p>
      </div>
      <SignInForm />
    </div>
  )
}
