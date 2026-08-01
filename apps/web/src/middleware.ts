import { betterFetch } from '@better-fetch/fetch'
import type { Session } from 'better-auth/types'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/api/auth']

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Local development can use the production Better Auth endpoint. Its
  // cross-domain cookie is unavailable to this local server, so this explicit
  // opt-in bypasses only the local middleware check.
  if (process.env['LOCAL_DEV_USE_REMOTE_AUTH'] === 'true') {
    return NextResponse.next()
  }

  // Usar URL interna (localhost) para evitar conexão SSL dentro do container
  // O Traefik termina o TLS externamente — internamente é sempre HTTP
  const internalBase = process.env['NODE_ENV'] === 'production'
    ? 'http://localhost:3000'
    : request.nextUrl.origin
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
