'use client'

import { useSession } from '@/lib/auth-client'
import { UserMenu } from '@/components/user-menu'
import Link from 'next/link'
import { NavLinks } from '@/components/nav-links'
import { CommandPalette } from '@/components/command-palette'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const name = session?.user?.name ?? 'Usuário'

  function openCommandPalette() {
    const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
    window.dispatchEvent(e)
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--canvas)' }}>

      {/* Sidebar */}
      <aside
        data-print-hide
        className="flex w-64 shrink-0 flex-col bg-[#e6f6ff]"
        style={{ borderRight: '1px solid var(--border-soft)' }}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-3 px-5">
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <span
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                architecture
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-[#003746] leading-none">LicitaCAT</p>
              <p className="text-[11px] text-slate-500 leading-none mt-1">Engenharia & Licitações</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <NavLinks />

        {/* CTA Novo Edital */}
        <div className="mt-auto px-4 pb-4">
          <Link
            href="/editais/upload"
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Novo Edital
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Top App Bar */}
        <header
          data-print-hide
          className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-4 bg-white/80 px-6 backdrop-blur-md"
          style={{ borderBottom: '1px solid var(--border-soft)' }}
        >
          {/* Search */}
          <button
            onClick={openCommandPalette}
            className="flex flex-1 max-w-md items-center gap-2.5 rounded-full bg-[#e6f6ff] px-4 py-2 text-left transition-colors hover:bg-[#dbf1fe]"
          >
            <span className="material-symbols-outlined text-[20px] text-slate-400">search</span>
            <span className="flex-1 text-sm text-slate-400">Buscar editais, processos ou CATs...</span>
            <kbd className="text-[10px] text-slate-400 font-medium bg-white/70 px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>

          <div className="flex items-center gap-3 ml-auto">
            {/* Notifications */}
            <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>

            {/* Business */}
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100">
              <span className="material-symbols-outlined text-[22px]">business</span>
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-slate-200" />

            {/* User info */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-700 leading-none">
                  {name}
                </p>
                <p className="text-[11px] text-slate-400 leading-none mt-0.5">Administrador</p>
              </div>
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* Command Palette — global ⌘K */}
      <CommandPalette />
    </div>
  )
}
