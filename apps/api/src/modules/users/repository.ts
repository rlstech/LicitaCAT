import { db } from '@licitacat/db'
import { users } from '@licitacat/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import type { UserRole } from '@licitacat/shared/types'

export async function listUsers(tenantId: string) {
  return db.query.users.findMany({
    where: eq(users.tenantId, tenantId),
    columns: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      authProviderId: false, // never expose Clerk ID
      createdAt: true,
    },
    orderBy: (u, { asc }) => asc(u.createdAt),
  })
}

export async function findUserById(tenantId: string, id: string) {
  return db.query.users.findFirst({
    where: and(eq(users.tenantId, tenantId), eq(users.id, id)),
  })
}

export async function findUserByEmail(tenantId: string, email: string) {
  return db.query.users.findFirst({
    where: and(eq(users.tenantId, tenantId), eq(users.email, email)),
  })
}

export async function findPendingUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: and(eq(users.email, email), isNull(users.authProviderId)),
  })
}

export async function createInvitedUser(
  tenantId: string,
  data: { email: string; name: string; role: UserRole },
) {
  const [created] = await db
    .insert(users)
    .values({ tenantId, ...data })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
  return created
}

export async function updateUser(
  tenantId: string,
  id: string,
  patch: { role?: UserRole; active?: boolean },
) {
  const [updated] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(users.tenantId, tenantId), eq(users.id, id)))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
  return updated
}

export async function linkAuthProvider(id: string, authProviderId: string) {
  const [updated] = await db
    .update(users)
    .set({ authProviderId, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()
  return updated
}
