import { db } from '@licitacat/db'
import { cats, catItens, profissionaisTecnicos, crossingItemCats, processingJobs } from '@licitacat/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import type {
  CreateProfissionalInput,
  UpdateProfissionalInput,
  CreateCatItemInput,
  UpdateCatItemInput,
  UpdateCatInput,
} from '@licitacat/shared/schemas'

export async function listProfissionais(tenantId: string) {
  return db
    .select()
    .from(profissionaisTecnicos)
    .where(eq(profissionaisTecnicos.tenantId, tenantId))
    .orderBy(profissionaisTecnicos.nome)
}

export async function createProfissional(
  tenantId: string,
  data: CreateProfissionalInput,
) {
  const [created] = await db
    .insert(profissionaisTecnicos)
    .values({ tenantId, ...data })
    .returning()
  return created
}

export async function updateProfissional(
  tenantId: string,
  profissionalId: string,
  data: UpdateProfissionalInput,
) {
  const [updated] = await db
    .update(profissionaisTecnicos)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(profissionaisTecnicos.id, profissionalId),
        eq(profissionaisTecnicos.tenantId, tenantId),
      ),
    )
    .returning()
  return updated
}

export async function listCats(
  tenantId: string,
  page: number,
  limit: number,
  profissionalId?: string,
  ativo?: boolean,
) {
  const offset = (page - 1) * limit
  const conditions = [eq(cats.tenantId, tenantId)]
  if (profissionalId) conditions.push(eq(cats.profissionalId, profissionalId))
  if (ativo !== undefined) conditions.push(eq(cats.ativo, ativo))

  const whereClause = and(...conditions)

  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(cats)
      .where(whereClause)
      .orderBy(desc(cats.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(cats).where(whereClause),
  ])

  return { data: rows, total: total?.count ?? 0, page, limit }
}

export async function findCatById(tenantId: string, catId: string) {
  return db.query.cats.findFirst({
    where: and(eq(cats.id, catId), eq(cats.tenantId, tenantId)),
    with: { profissional: true },
  })
}

export async function updateCat(
  tenantId: string,
  catId: string,
  data: UpdateCatInput,
) {
  const [updated] = await db
    .update(cats)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(cats.id, catId), eq(cats.tenantId, tenantId)))
    .returning()
  return updated
}

export async function deleteCat(tenantId: string, catId: string) {
  // 1. Remove referências em crossing_item_cats (sem cascade no FK)
  await db.delete(crossingItemCats).where(eq(crossingItemCats.catId, catId))

  // 2. Remove jobs de processamento da CAT
  await db
    .delete(processingJobs)
    .where(
      and(eq(processingJobs.tenantId, tenantId), eq(processingJobs.entityId, catId)),
    )

  // 3. Remove a CAT (cat_itens cascadeiam automaticamente)
  await db
    .delete(cats)
    .where(and(eq(cats.id, catId), eq(cats.tenantId, tenantId)))
}

export async function listCatItens(tenantId: string, catId: string) {
  return db
    .select()
    .from(catItens)
    .where(and(eq(catItens.tenantId, tenantId), eq(catItens.catId, catId)))
    .orderBy(catItens.ordem)
}

export async function createCatItem(
  tenantId: string,
  catId: string,
  data: CreateCatItemInput,
) {
  const [created] = await db
    .insert(catItens)
    .values({ tenantId, catId, origem: 'human_added', ...data })
    .returning()
  return created
}

export async function updateCatItem(
  tenantId: string,
  itemId: string,
  data: UpdateCatItemInput,
) {
  const [updated] = await db
    .update(catItens)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(catItens.id, itemId), eq(catItens.tenantId, tenantId)))
    .returning()
  return updated
}

export async function deleteCatItem(tenantId: string, itemId: string) {
  await db
    .delete(catItens)
    .where(and(eq(catItens.id, itemId), eq(catItens.tenantId, tenantId)))
}
