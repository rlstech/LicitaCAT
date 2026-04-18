'use client'

import { useSession } from '@/lib/auth-client'
import { useCallback } from 'react'

/**
 * Hook de compatibilidade: retorna uma função `getToken` com a mesma
 * assinatura que `useAuth().getToken` do Clerk, facilitando a migração.
 *
 * Usa useCallback para garantir referência estável — sem isso, qualquer
 * useEffect que dependa de `getToken` dispara em loop infinito.
 */
export function useToken(): () => Promise<string | null> {
  const { data: session } = useSession()
  const token = session?.session.token ?? null
  return useCallback(() => Promise.resolve(token), [token])
}
