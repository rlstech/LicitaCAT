'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const settingsTabs = [
  { href: '/configuracoes/usuarios', label: 'Usuários', icon: 'group' },
  { href: '/configuracoes/monitoramento-pncp', label: 'Monitoramento PNCP', icon: 'sync' },
]

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500">Gerencie usuários e preferências da sua empresa.</p>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 border-b border-slate-200">
        {settingsTabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-[#003746] text-[#003746]'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              <span className={`material-symbols-outlined text-[0.95rem] ${isActive ? 'text-[#003746]' : 'text-slate-400'}`}>
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Content */}
      {children}
    </div>
  )
}
