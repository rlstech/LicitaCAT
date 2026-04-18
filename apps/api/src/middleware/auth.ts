import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@licitacat/db'
import { users, baSession, baUser } from '@licitacat/db/schema'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { UnauthorizedError, ForbiddenError } from '@licitacat/shared/errors'
import type { UserRole } from '@licitacat/shared/types'

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string
    userId: string
    userRole: UserRole
  }
}

export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  // Extrair Bearer token do header Authorization
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError()
  }
  const token = authHeader.slice(7)

  // Validar sessão no banco (ba_session)
  const sessionRow = await db
    .select({
      sessionId: baSession.id,
      userId: baSession.userId,
      expiresAt: baSession.expiresAt,
      email: baUser.email,
      baUserId: baUser.id,
    })
    .from(baSession)
    .innerJoin(baUser, eq(baSession.userId, baUser.id))
    .where(and(eq(baSession.token, token), gt(baSession.expiresAt, new Date())))
    .limit(1)
    .then(rows => rows[0])

  if (!sessionRow) {
    throw new UnauthorizedError()
  }

  const { email, baUserId } = sessionRow

  // 1. Fast path: find by Better Auth user ID (normal flow)
  let user = await db.query.users.findFirst({
    where: eq(users.authProviderId, baUserId),
  })

  // 2. Fallback: find by email and auto-link
  // Cobre dois casos: (a) auth_provider_id NULL (usuário convidado novo)
  //                  (b) auth_provider_id com ID antigo do Clerk (user_xxx)
  if (!user) {
    const byEmail = await db.query.users.findFirst({
      where: eq(users.email, email),
    })
    if (byEmail && (byEmail.authProviderId === null || byEmail.authProviderId?.startsWith('user_'))) {
      const [linked] = await db
        .update(users)
        .set({ authProviderId: baUserId, updatedAt: new Date() })
        .where(eq(users.id, byEmail.id))
        .returning()
      request.log.info({ email, userId: byEmail.id }, 'Auto-linked Better Auth user')
      user = linked
    } else {
      request.log.warn({ email, baUserId }, 'Better Auth user not found in tenant — no pending invite')
    }
  }

  if (!user || !user.active) {
    throw new UnauthorizedError('User not found or inactive')
  }

  request.tenantId = user.tenantId
  request.userId = user.id
  request.userRole = user.role
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.userRole)) {
      throw new ForbiddenError(
        `Role ${request.userRole} is not allowed. Required: ${roles.join(' or ')}`,
      )
    }
  }
}
