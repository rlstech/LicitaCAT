import { db } from '@licitacat/db'
import { editais, editalRequisitos } from '@licitacat/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import type { UpdateEditalInput, UpdateRequisitoInput } from '@licitacat/shared/schemas'

export async function listEditais(
  tenantId: string,
  page: number,
  limit: number,
  status?: string,
) {
  const offset = (page - 1) * limit
  const whereClause = status
    ? and(eq(editais.tenantId, tenantId), eq(editais.status, status as typeof editais.status._.data))
    : eq(editais.tenantId, tenantId)

  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(editais)
      .where(whereClause)
      .orderBy(desc(editais.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(editais).where(whereClause),
  ])

  return {
    data: rows,
    total: total?.count ?? 0,
    page,
    limit,
  }
}

export async function findEditalById(tenantId: string, editalId: string) {
  return db.query.editais.findFirst({
    where: and(eq(editais.id, editalId), eq(editais.tenantId, tenantId)),
  })
}

export async function updateEdital(
  tenantId: string,
  editalId: string,
  data: UpdateEditalInput,
) {
  const [updated] = await db
    .update(editais)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(editais.id, editalId), eq(editais.tenantId, tenantId)))
    .returning()
  return updated
}

export async function listRequisitos(tenantId: string, editalId: string) {
  return db
    .select()
    .from(editalRequisitos)
    .where(
      and(
        eq(editalRequisitos.tenantId, tenantId),
        eq(editalRequisitos.editalId, editalId),
      ),
    )
    .orderBy(editalRequisitos.categoria, editalRequisitos.createdAt)
}

export async function updateRequisito(
  tenantId: string,
  requisitoId: string,
  data: UpdateRequisitoInput,
  editedBy: string,
) {
  const [updated] = await db
    .update(editalRequisitos)
    .set({ ...data, editedBy, updatedAt: new Date() })
    .where(
      and(
        eq(editalRequisitos.id, requisitoId),
        eq(editalRequisitos.tenantId, tenantId),
      ),
    )
    .returning()
  return updated
}
