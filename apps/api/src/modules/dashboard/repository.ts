import { db } from '@licitacat/db'
import { editais, editalRequisitos, cats, crossings, crossingItems, processingJobs } from '@licitacat/db/schema'
import { eq, and, gte, lte, count, avg, desc, sql, inArray } from 'drizzle-orm'

export async function getDashboardStats(tenantId: string) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const now = new Date()
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const [editaisStats, catsCount, crossingsStats, recentJobs, pendingCrossingsRows, upcomingEditais, reviewPendingEditais] = await Promise.all([
    db
      .select({ status: editais.status, total: count() })
      .from(editais)
      .where(eq(editais.tenantId, tenantId))
      .groupBy(editais.status),

    db
      .select({ total: count() })
      .from(cats)
      .where(and(eq(cats.tenantId, tenantId), eq(cats.ativo, true))),

    db
      .select({
        total: count(),
        avgScore: avg(crossings.scoreAderencia),
      })
      .from(crossings)
      .where(
        and(
          eq(crossings.tenantId, tenantId),
          gte(crossings.createdAt, startOfMonth),
          eq(crossings.status, 'completed'),
        ),
      ),

    db
      .select()
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.tenantId, tenantId),
          inArray(processingJobs.jobType, ['ocr', 'edital_extraction', 'cat_extraction', 'crossing']),
        ),
      )
      .orderBy(desc(processingJobs.createdAt))
      .limit(10),

    db
      .selectDistinct({ crossingId: crossingItems.crossingId })
      .from(crossingItems)
      .where(and(
        eq(crossingItems.tenantId, tenantId),
        eq(crossingItems.resultado, 'atendido_parcialmente'),
        eq(crossingItems.humanOverride, false),
      )),

    db
      .select({
        id: editais.id,
        numeroEdital: editais.numeroEdital,
        objeto: editais.objeto,
        valorEstimado: editais.valorEstimado,
        dataAbertura: editais.dataAbertura,
      })
      .from(editais)
      .where(and(
        eq(editais.tenantId, tenantId),
        gte(editais.dataAbertura, now),
        lte(editais.dataAbertura, in14),
      ))
      .orderBy(editais.dataAbertura)
      .limit(5),

    db
      .select({
        id: editais.id,
        objeto: editais.objeto,
        orgaoLicitante: editais.orgaoLicitante,
        modalidade: editais.modalidade,
        dataAbertura: editais.dataAbertura,
        updatedAt: editais.updatedAt,
        avgConfidence: sql<string>`COALESCE(ROUND(AVG(${editalRequisitos.aiConfidenceScore})), 0)`,
      })
      .from(editais)
      .leftJoin(editalRequisitos, eq(editalRequisitos.editalId, editais.id))
      .where(and(
        eq(editais.tenantId, tenantId),
        eq(editais.status, 'review_pending'),
      ))
      .groupBy(editais.id, editais.objeto, editais.orgaoLicitante, editais.modalidade, editais.dataAbertura, editais.updatedAt)
      .orderBy(desc(editais.updatedAt))
      .limit(5),
  ])

  const editaisByStatus = Object.fromEntries(
    editaisStats.map((r) => [r.status, Number(r.total)]),
  )

  // Enrich recentJobs with entity names
  const editalIds   = recentJobs.filter(j => j.entityType === 'edital').map(j => j.entityId).filter(Boolean) as string[]
  const catIds      = recentJobs.filter(j => j.entityType === 'cat').map(j => j.entityId).filter(Boolean) as string[]
  const crossingIds = recentJobs.filter(j => j.entityType === 'crossing').map(j => j.entityId).filter(Boolean) as string[]

  const [editaisNames, catsNames, crossingsData] = await Promise.all([
    editalIds.length > 0
      ? db.select({ id: editais.id, objeto: editais.objeto, orgaoLicitante: editais.orgaoLicitante }).from(editais).where(inArray(editais.id, editalIds))
      : Promise.resolve([] as { id: string; objeto: string | null; orgaoLicitante: string | null }[]),
    catIds.length > 0
      ? db.select({ id: cats.id, descricaoTecnica: cats.descricaoTecnica }).from(cats).where(inArray(cats.id, catIds))
      : Promise.resolve([] as { id: string; descricaoTecnica: string | null }[]),
    crossingIds.length > 0
      ? db.select({ id: crossings.id, scoreAderencia: crossings.scoreAderencia }).from(crossings).where(inArray(crossings.id, crossingIds))
      : Promise.resolve([] as { id: string; scoreAderencia: number | null }[]),
  ])

  const editaisMap   = Object.fromEntries(editaisNames.map(e => [e.id, e]))
  const catsMap      = Object.fromEntries(catsNames.map(c => [c.id, c]))
  const crossingsMap = Object.fromEntries(crossingsData.map(cr => [cr.id, cr]))

  const enrichedJobs = recentJobs.map(job => {
    let entityName: string | null = null
    if (job.entityType === 'edital') {
      const e = editaisMap[job.entityId ?? '']
      entityName = e?.objeto ?? e?.orgaoLicitante ?? null
    } else if (job.entityType === 'cat') {
      entityName = catsMap[job.entityId ?? '']?.descricaoTecnica ?? null
    } else if (job.entityType === 'crossing') {
      const score = crossingsMap[job.entityId ?? '']?.scoreAderencia
      entityName = score != null ? `Score: ${score}%` : null
    }
    return { ...job, entityName }
  })

  return {
    editais: {
      total: editaisStats.reduce((acc, r) => acc + Number(r.total), 0),
      prontos: editaisByStatus['ready'] ?? 0,
      processando:
        (editaisByStatus['ocr_processing'] ?? 0) +
        (editaisByStatus['extracting'] ?? 0),
      aguardandoRevisao: editaisByStatus['review_pending'] ?? 0,
      byStatus: editaisByStatus,
    },
    cats: {
      total: Number(catsCount[0]?.total ?? 0),
    },
    crossings: {
      totalThisMonth: Number(crossingsStats[0]?.total ?? 0),
      avgScore: crossingsStats[0]?.avgScore
        ? Math.round(Number(crossingsStats[0].avgScore))
        : null,
    },
    recentJobs: enrichedJobs,
    crossingsPendingReview: pendingCrossingsRows.length,
    upcomingEditais,
    reviewPendingEditais,
  }
}

export async function getEditaisCostSummary(tenantId: string) {
  const result = await db
    .select({
      totalOcrCost: sql<string>`COALESCE(SUM(ocr_cost_usd), 0)`,
      totalAiCost: sql<string>`COALESCE(SUM(ai_extraction_cost_usd), 0)`,
    })
    .from(editais)
    .where(eq(editais.tenantId, tenantId))

  return result[0] ?? { totalOcrCost: '0', totalAiCost: '0' }
}
