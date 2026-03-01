import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-brand-700">LicitaCAT</h1>
          <p className="mt-2 text-gray-600">
            Plataforma de qualificação para licitações
          </p>
        </div>
        <SignIn />
      </div>
    </div>
  )
}
