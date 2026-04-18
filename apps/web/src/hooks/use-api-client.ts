'use client'

import { useSession } from '@/lib/auth-client'
import { ApiClient } from '@/lib/api'
import { useMemo } from 'react'

export function useApiClient(): ApiClient {
  const { data: session } = useSession()
  return useMemo(
    () => new ApiClient(() => Promise.resolve(session?.session.token ?? null)),
    [session?.session.token],
  )
}
