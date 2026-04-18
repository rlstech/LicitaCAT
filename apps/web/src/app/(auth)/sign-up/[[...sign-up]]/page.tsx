import Link from 'next/link'
import { SignUpForm } from '@/components/sign-up-form'

export default function SignUpPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Criar conta</h1>
        <p className="mt-2 text-sm text-slate-500">
          Já tem conta?{' '}
          <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
            Entre aqui
          </Link>
        </p>
      </div>
      <SignUpForm />
    </div>
  )
}
