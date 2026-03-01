import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'LicitaCAT — Plataforma de Qualificação para Licitações',
  description:
    'Cruzamento inteligente de editais com seu acervo de CATs para maximizar suas chances em licitações públicas.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
