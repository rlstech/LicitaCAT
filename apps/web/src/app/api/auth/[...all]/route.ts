import { auth } from '@licitacat/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const dynamic = 'force-dynamic'

export const { GET, POST } = toNextJsHandler(auth)
