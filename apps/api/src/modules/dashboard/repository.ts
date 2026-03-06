import { db } from '@licitacat/db'
import { editais, cats, crossings, processingJobs } from '@licitacat/db/schema'
import { eq, and, gte, count, avg, desc, sql } from 'drizzle-orm'

export async function getDashboardStats(tenantId: string) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [editaisStats, catsCount, crossingsStats, recentJobs] = await Promise.all([
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
      .where(eq(processingJobs.tenantId, tenantId))
      .orderBy(desc(processingJobs.createdAt))
      .limit(10),
  ])

  const editaisByStatus = Object.fromEntries(
    editaisStats.map((r) => [r.status, Number(r.total)]),
  )

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
    recentJobs,
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
