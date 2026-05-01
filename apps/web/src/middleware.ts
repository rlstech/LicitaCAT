import { betterFetch } from '@better-fetch/fetch'
import type { Session } from 'better-auth/types'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/api/auth']

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Usar URL interna (localhost) para evitar conexão SSL dentro do container
  // O Traefik termina o TLS externamente — internamente é sempre HTTP
  const internalBase = 'http://localhost:3000'
  const { data: session } = await betterFetch<Session>(
    '/api/auth/get-session',
    {
      baseURL: internalBase,
      headers: { cookie: request.headers.get('cookie') ?? '' },
    },
  )

  if (!session) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api(?!/auth).*)'],
}
