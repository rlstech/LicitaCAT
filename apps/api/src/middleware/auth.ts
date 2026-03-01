import type { FastifyRequest, FastifyReply } from 'fastify'
import { getAuth } from '@clerk/fastify'
import { db } from '@licitacat/db'
import { users } from '@licitacat/db/schema'
import { eq } from 'drizzle-orm'
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

  const user = await db.query.users.findFirst({
    where: eq(users.authProviderId, authProviderId),
  })

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
