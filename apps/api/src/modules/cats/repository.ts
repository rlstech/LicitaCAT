import { db } from '@licitacat/db'
import { cats, catItens, profissionaisTecnicos, crossingItemCats, processingJobs } from '@licitacat/db/schema'
import { eq, and, desc, count, ilike, sql, getTableColumns } from 'drizzle-orm'
import type {
  CreateProfissionalInput,
  UpdateProfissionalInput,
  CreateCatItemInput,
  UpdateCatItemInput,
  UpdateCatInput,
} from '@licitacat/shared/schemas'

/** Primeira letra maiúscula, restante minúsculo */
function sentenceCase(str: string): string {
  if (!str || str.length === 0) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

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
      .select({
        ...getTableColumns(cats),
        itemCount: sql<number>`COALESCE(COUNT(${catItens.id}), 0)::int`,
      })
      .from(cats)
      .leftJoin(catItens, eq(catItens.catId, cats.id))
      .where(whereClause)
      .groupBy(cats.id)
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
  const { quantitativoValor, ...rest } = data
  const [updated] = await db
    .update(cats)
    .set({
      ...rest,
      ...(quantitativoValor !== undefined ? { quantitativoValor: quantitativoValor.toFixed(4) } : {}),
      updatedAt: new Date(),
    })
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
  const { quantidade, descricao, unidade, ...rest } = data
  const [created] = await db
    .insert(catItens)
    .values({
      tenantId,
      catId,
      origem: 'human_added',
      ...rest,
      descricao: sentenceCase(descricao),
      ...(unidade ? { unidade: sentenceCase(unidade) } : {}),
      ...(quantidade !== undefined ? { quantidade: quantidade.toFixed(4) } : {}),
    })
    .returning()
  return created
}

export async function updateCatItem(
  tenantId: string,
  itemId: string,
  data: UpdateCatItemInput,
) {
  const { quantidade, descricao, unidade, ...rest } = data
  const [updated] = await db
    .update(catItens)
    .set({
      ...rest,
      ...(descricao !== undefined ? { descricao: sentenceCase(descricao) } : {}),
      ...(unidade !== undefined ? { unidade: unidade ? sentenceCase(unidade) : null } : {}),
      ...(quantidade !== undefined ? { quantidade: quantidade.toFixed(4) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(catItens.id, itemId), eq(catItens.tenantId, tenantId)))
    .returning()
  return updated
}

export async function searchCatItens(
  tenantId: string,
  q: string,
  catId?: string,
  limit = 100,
) {
  const conditions = [
    eq(catItens.tenantId, tenantId),
    ilike(catItens.descricao, `%${q}%`),
  ]
  if (catId) conditions.push(eq(catItens.catId, catId))

  return db
    .select({
      id: catItens.id,
      catId: catItens.catId,
      descricao: catItens.descricao,
      unidade: catItens.unidade,
      quantidade: catItens.quantidade,
      numeroCat: cats.numeroCat,
      empresaContratante: cats.empresaContratante,
      tipoObraServico: cats.tipoObraServico,
      fileName: cats.fileName,
    })
    .from(catItens)
    .innerJoin(cats, eq(catItens.catId, cats.id))
    .where(and(...conditions))
    .orderBy(catItens.descricao)
    .limit(limit)
}

export async function normalizeCatItensDescriptions(tenantId: string) {
  await db.execute(sql`
    UPDATE cat_itens
    SET
      descricao = UPPER(LEFT(descricao, 1)) || LOWER(SUBSTRING(descricao FROM 2)),
      unidade = CASE
        WHEN unidade IS NOT NULL
        THEN UPPER(LEFT(unidade, 1)) || LOWER(SUBSTRING(unidade FROM 2))
        ELSE NULL
      END
    WHERE tenant_id = ${tenantId}
  `)
  const result = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text AS count FROM cat_itens WHERE tenant_id = ${tenantId}`
  )
  return { normalized: Number(result.rows[0]?.count ?? 0) }
}

export async function deleteCatItem(tenantId: string, itemId: string) {
  await db
    .delete(catItens)
    .where(and(eq(catItens.id, itemId), eq(catItens.tenantId, tenantId)))
}
