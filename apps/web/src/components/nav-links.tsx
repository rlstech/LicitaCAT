'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/editais', label: 'Editais', icon: 'description' },
  { href: '/cats', label: 'CATs', icon: 'verified' },
  { href: '/cruzamentos', label: 'Cruzamentos', icon: 'layers' },
  { href: '/cats/profissionais', label: 'Profissionais', icon: 'engineering' },
  { href: '/configuracoes', label: 'Configurações', icon: 'settings' },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto scrollbar-thin px-4 py-3">
      <div className="space-y-1">
        {mainNav.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200 ${
                isActive
                  ? 'translate-x-1 bg-white font-semibold text-[#003746] shadow-sm'
                  : 'text-slate-600 hover:bg-[#cfe6f2]/50 hover:text-[#003746]'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={
                  isActive && item.icon === 'verified'
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
