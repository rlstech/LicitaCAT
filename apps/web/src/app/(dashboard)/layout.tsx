import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/editais', label: 'Editais' },
  { href: '/cats', label: 'Acervo de CATs' },
  { href: '/cruzamentos', label: 'Cruzamentos' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="text-xl font-bold text-brand-700">
            LicitaCAT
          </Link>
        </div>
        <nav className="mt-6 px-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end border-b bg-white px-6">
          <UserButton afterSignOutUrl="/sign-in" />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
