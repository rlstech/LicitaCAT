'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from '@/lib/auth-client'

export function UserMenu() {
  const router = useRouter()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  const name = session?.user?.name ?? 'Usuário'
  const email = session?.user?.email ?? ''
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  async function handleSignOut() {
    await signOut()
    router.push('/sign-in')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
        aria-label="Menu do usuário"
      >
        {initials || 'U'}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-50 min-w-[200px] rounded-xl border border-slate-200 bg-white shadow-lg py-1">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
              <p className="text-xs text-slate-500 truncate">{email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  )
}
