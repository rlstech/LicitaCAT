import type { FastifyRequest, FastifyReply } from 'fastify'
import { getAuth, clerkClient } from '@clerk/fastify'
import { db } from '@licitacat/db'
import { users } from '@licitacat/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
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
  reply: FastifyReply,
): Promise<void> {
  const { userId: authProviderId } = getAuth(request)

  if (!authProviderId) {
    throw new UnauthorizedError()
  }

  // 1. Fast path: find by Clerk user ID (normal flow)
  let user = await db.query.users.findFirst({
    where: eq(users.authProviderId, authProviderId),
  })

  // 2. Fallback: find invited user by email and auto-link
  if (!user) {
    try {
      const clerkUser = await clerkClient.users.getUser(authProviderId)
      const email = clerkUser.emailAddresses[0]?.emailAddress
      if (email) {
        const pending = await db.query.users.findFirst({
          where: and(eq(users.email, email), isNull(users.authProviderId)),
        })
        if (pending) {
          const [linked] = await db
            .update(users)
            .set({ authProviderId, updatedAt: new Date() })
            .where(eq(users.id, pending.id))
            .returning()
          request.log.info({ email, userId: pending.id }, 'Auto-linked Clerk user to invited record')
          user = linked
        } else {
          request.log.warn({ email, authProviderId }, 'Clerk user not found in tenant — no pending invite')
        }
      }
    } catch (err) {
      request.log.error({ authProviderId, err }, 'Clerk API call failed during auto-link')
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
