import { db } from '@licitacat/db'
import { pncpCache, pncpSyncConfig } from '@licitacat/db/schema'
import { and, gte, lte, ilike, inArray, eq, desc, asc, count, sql, arrayOverlaps } from 'drizzle-orm'
import type { PncpCacheBuscarQuery, PncpSyncConfigBody } from './schema.js'

export async function searchPncpCache(params: PncpCacheBuscarQuery) {
  const conditions = []

  if (params.ufs) {
    const ufList = params.ufs.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length === 2)
    if (ufList.length > 0) conditions.push(inArray(pncpCache.uf, ufList))
  }
  if (params.modalidade) {
    conditions.push(eq(pncpCache.codigoModalidade, params.modalidade))
  }
  if (params.codigoMunicipioIbge) {
    conditions.push(eq(pncpCache.codigoMunicipioIbge, params.codigoMunicipioIbge))
  }
  if (params.nomeMunicipio) {
    conditions.push(ilike(pncpCache.nomeMunicipio, `%${params.nomeMunicipio}%`))
  }
  if (params.situacaoCompraId) {
    conditions.push(eq(pncpCache.situacaoCompraId, params.situacaoCompraId))
  }
  if (params.valorMin != null) {
    conditions.push(gte(pncpCache.valorTotalEstimado, String(params.valorMin)))
  }
  if (params.valorMax != null) {
    conditions.push(lte(pncpCache.valorTotalEstimado, String(params.valorMax)))
  }
  if (params.tipoBusca === 'proposta') {
    // Filtrar pela data de encerramento (prazo real), com fallback para abertura de proposta
    const dateCol = sql`COALESCE(${pncpCache.dataEncerramentoProposta}, ${pncpCache.dataAberturaProposta})`
    if (params.dataInicial) {
      const d = `${params.dataInicial.slice(0, 4)}-${params.dataInicial.slice(4, 6)}-${params.dataInicial.slice(6)}`
      conditions.push(sql`${dateCol} >= ${d}::timestamptz`)
    }
    if (params.dataFinal) {
      const d = `${params.dataFinal.slice(0, 4)}-${params.dataFinal.slice(4, 6)}-${params.dataFinal.slice(6)}T23:59:59`
      conditions.push(sql`${dateCol} <= ${d}::timestamptz`)
    }
  } else {
    if (params.dataInicial) {
      const d = `${params.dataInicial.slice(0, 4)}-${params.dataInicial.slice(4, 6)}-${params.dataInicial.slice(6)}`
      conditions.push(gte(pncpCache.dataPublicacaoPncp, d))
    }
    if (params.dataFinal) {
      const d = `${params.dataFinal.slice(0, 4)}-${params.dataFinal.slice(4, 6)}-${params.dataFinal.slice(6)}`
      conditions.push(lte(pncpCache.dataPublicacaoPncp, d))
    }
  }
  if (params.objeto) {
    conditions.push(ilike(pncpCache.objeto, `%${params.objeto}%`))
  }
  if (params.segmentos) {
    const segList = params.segmentos.split('|').map(s => s.trim()).filter(Boolean)
    if (segList.length > 0) {
      conditions.push(arrayOverlaps(pncpCache.segmentos, segList))
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const offset = (params.page - 1) * params.limit

  const orderExpr = params.sortBy === 'valorTotalEstimado'
    ? pncpCache.valorTotalEstimado
    : params.sortBy === 'dataAberturaProposta'
      ? pncpCache.dataAberturaProposta
      : params.sortBy === 'dataEncerramentoProposta'
        ? sql`COALESCE(${pncpCache.dataEncerramentoProposta}, ${pncpCache.dataAberturaProposta})`
        : pncpCache.dataPublicacaoPncp

  const [data, countResult] = await Promise.all([
    db.select().from(pncpCache)
      .where(where)
      .orderBy(params.sortOrder === 'desc' ? desc(orderExpr) : asc(orderExpr))
      .limit(params.limit)
      .offset(offset),
    db.select({ total: count() }).from(pncpCache).where(where),
  ])
  const total = countResult[0]?.total ?? 0

  return {
    data,
    total,
    page:       params.page,
    limit:      params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  }
}

export async function getSyncConfig(tenantId: string) {
  return db.query.pncpSyncConfig.findFirst({
    where: eq(pncpSyncConfig.tenantId, tenantId),
  })
}

export async function upsertSyncConfig(tenantId: string, values: PncpSyncConfigBody) {
  const [saved] = await db.insert(pncpSyncConfig)
    .values({
      tenantId,
      ufs:           values.ufs,
      modalidades:   values.modalidades,
      retentionDays: values.retentionDays,
      isActive:      values.isActive,
    })
    .onConflictDoUpdate({
      target: pncpSyncConfig.tenantId,
      set: {
        ufs:           sql`excluded.ufs`,
        modalidades:   sql`excluded.modalidades`,
        retentionDays: sql`excluded.retention_days`,
        isActive:      sql`excluded.is_active`,
        updatedAt:     new Date(),
      },
    })
    .returning()
  return saved!
}
