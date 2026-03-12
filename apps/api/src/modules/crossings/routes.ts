import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { NotFoundError, ValidationError } from '@licitacat/shared/errors'
import { db } from '@licitacat/db'
import { crossings, crossingItems, crossingItemCats, reqParcelasRelevancia, editais, processingJobs, cats } from '@licitacat/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { crossingQueue } from '@licitacat/queue/queues'

const RESULTADO_LABELS: Record<string, string> = {
  atendido: 'Atendido',
  atendido_parcialmente: 'Atendido Parcialmente',
  gap: 'Gap',
}


const RECOMENDACAO_LABELS: Record<string, string> = {
  participar: 'Participar',
  participar_com_ressalvas: 'Participar com Ressalvas',
  nao_participar: 'Não Participar',
}

function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const CrossingParamsSchema = z.object({ crossingId: z.string().uuid() })

const TriggerCrossingSchema = z.object({
  editalId: z.string().uuid(),
})

const OverrideItemSchema = z.object({
  resultado: z.enum(['atendido', 'atendido_parcialmente', 'gap']),
  note: z.string().max(1000).optional(),
})

export async function crossingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /api/crossings
  app.get('/', async (request) => {
    const rows = await db
      .select({
        id: crossings.id,
        editalId: crossings.editalId,
        status: crossings.status,
        scoreAderencia: crossings.scoreAderencia,
        totalRequisitos: crossings.totalRequisitos,
        requisitosAtendidos: crossings.requisitosAtendidos,
        requisitosComRessalva: crossings.requisitosComRessalva,
        requisitosGap: crossings.requisitosGap,
        recomendacao: crossings.recomendacao,
        aiCostUsd: crossings.aiCostUsd,
        processingTimeSeconds: crossings.processingTimeSeconds,
        createdAt: crossings.createdAt,
        editalNumero: editais.numeroEdital,
        editalFileName: editais.fileName,
        editalOrgao: editais.orgaoLicitante,
      })
      .from(crossings)
      .innerJoin(editais, eq(crossings.editalId, editais.id))
      .where(eq(crossings.tenantId, request.tenantId))
      .orderBy(desc(crossings.createdAt))
      .limit(50)
    return rows
  })

  // POST /api/crossings — trigger new crossing
  app.post(
    '/',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const body = TriggerCrossingSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())

      const [crossing] = await db
        .insert(crossings)
        .values({
          tenantId: request.tenantId,
          editalId: body.data.editalId,
          triggeredBy: request.userId,
          status: 'queued',
        })
        .returning()

      if (!crossing) throw new Error('Failed to create crossing')

      const [job] = await db
        .insert(processingJobs)
        .values({
          tenantId: request.tenantId,
          jobType: 'crossing',
          entityType: 'crossing',
          entityId: crossing.id,
          status: 'queued',
        })
        .returning()

      if (!job) throw new Error('Failed to create job')

      await crossingQueue.add('crossing', {
        tenantId: request.tenantId,
        crossingId: crossing.id,
        editalId: body.data.editalId,
        jobId: job.id,
      })

      return reply.status(202).send({ crossingId: crossing.id, status: 'queued' })
    },
  )

  // GET /api/crossings/:crossingId
  app.get('/:crossingId', async (request) => {
    const { crossingId } = CrossingParamsSchema.parse(request.params)

    const crossing = await db.query.crossings.findFirst({
      where: and(
        eq(crossings.id, crossingId),
        eq(crossings.tenantId, request.tenantId),
      ),
    })

    if (!crossing) throw new NotFoundError('Crossing', crossingId)
    return crossing
  })

  // GET /api/crossings/:crossingId/items
  app.get('/:crossingId/items', async (request) => {
    const { crossingId } = CrossingParamsSchema.parse(request.params)

    const items = await db
      .select({
        id: crossingItems.id,
        resultado: crossingItems.resultado,
        aiJustificativa: crossingItems.aiJustificativa,
        scoreSimilaridadeMax: crossingItems.scoreSimilaridadeMax,
        humanOverride: crossingItems.humanOverride,
        humanOverrideNote: crossingItems.humanOverrideNote,
        parcelaServico: reqParcelasRelevancia.servico,
        parcelaUnidade: reqParcelasRelevancia.unidade,
        parcelaQuantidadeMinima: reqParcelasRelevancia.quantidadeMinima,
      })
      .from(crossingItems)
      .innerJoin(reqParcelasRelevancia, eq(crossingItems.requisitoId, reqParcelasRelevancia.id))
      .where(
        and(
          eq(crossingItems.crossingId, crossingId),
          eq(crossingItems.tenantId, request.tenantId),
        ),
      )
      .orderBy(crossingItems.createdAt)

    const catMatchRows = await db
      .select({
        crossingItemId: crossingItemCats.crossingItemId,
        catId: crossingItemCats.catId,
        catItemId: crossingItemCats.catItemId,
        nivelMatch: crossingItemCats.nivelMatch,
        scoreSimilaridade: crossingItemCats.scoreSimilaridade,
        avaliacaoLlm: crossingItemCats.avaliacaoLlm,
        justificativaLlm: crossingItemCats.justificativaLlm,
        rankPosicao: crossingItemCats.rankPosicao,
        catEmpresaContratante: cats.empresaContratante,
        catTipoObra: cats.tipoObraServico,
        catNumeroCat: cats.numeroCat,
      })
      .from(crossingItemCats)
      .innerJoin(crossingItems, eq(crossingItemCats.crossingItemId, crossingItems.id))
      .innerJoin(cats, eq(crossingItemCats.catId, cats.id))
      .where(
        and(
          eq(crossingItems.crossingId, crossingId),
          eq(crossingItems.tenantId, request.tenantId),
        ),
      )
      .orderBy(crossingItemCats.rankPosicao)

    const catMatchMap = new Map<string, typeof catMatchRows>()
    for (const match of catMatchRows) {
      const arr = catMatchMap.get(match.crossingItemId) ?? []
      arr.push(match)
      catMatchMap.set(match.crossingItemId, arr)
    }

    return items.map((item) => ({
      ...item,
      catMatches: catMatchMap.get(item.id) ?? [],
    }))
  })

  // GET /api/crossings/:crossingId/export/csv
  app.get('/:crossingId/export/csv', async (request, reply) => {
    const { crossingId } = CrossingParamsSchema.parse(request.params)

    const crossing = await db.query.crossings.findFirst({
      where: and(
        eq(crossings.id, crossingId),
        eq(crossings.tenantId, request.tenantId),
      ),
    })
    if (!crossing) throw new NotFoundError('Crossing', crossingId)

    const edital = crossing.editalId
      ? await db.query.editais.findFirst({
          where: and(
            eq(editais.id, crossing.editalId),
            eq(editais.tenantId, request.tenantId),
          ),
        })
      : null

    const items = await db
      .select({
        resultado: crossingItems.resultado,
        aiJustificativa: crossingItems.aiJustificativa,
        scoreSimilaridadeMax: crossingItems.scoreSimilaridadeMax,
        humanOverride: crossingItems.humanOverride,
        humanOverrideNote: crossingItems.humanOverrideNote,
        parcelaServico: reqParcelasRelevancia.servico,
        quantidadeMinima: reqParcelasRelevancia.quantidadeMinima,
        unidade: reqParcelasRelevancia.unidade,
      })
      .from(crossingItems)
      .innerJoin(reqParcelasRelevancia, eq(crossingItems.requisitoId, reqParcelasRelevancia.id))
      .where(
        and(
          eq(crossingItems.crossingId, crossingId),
          eq(crossingItems.tenantId, request.tenantId),
        ),
      )
      .orderBy(crossingItems.createdAt)

    const reportDate = new Date().toLocaleDateString('pt-BR')
    const orgao = edital?.orgaoLicitante ?? ''
    const numeroEdital = edital?.numeroEdital ?? ''
    const recomendacao = crossing.recomendacao
      ? (RECOMENDACAO_LABELS[crossing.recomendacao] ?? crossing.recomendacao)
      : ''

    const metaRows = [
      `# Relatório de Cruzamento LicitaCAT`,
      `# Data:,${reportDate}`,
      `# Órgão Licitante:,${escapeCSV(orgao)}`,
      `# Número do Edital:,${escapeCSV(numeroEdital)}`,
      `# Score de Aderência:,${crossing.scoreAderencia ?? ''}`,
      `# Recomendação:,${recomendacao}`,
      `# Requisitos Atendidos:,${crossing.requisitosAtendidos ?? 0}`,
      `# Requisitos Parciais:,${crossing.requisitosComRessalva ?? 0}`,
      `# Gaps:,${crossing.requisitosGap ?? 0}`,
      ``,
    ]

    const header = [
      'Serviço / Parcela de Relevância',
      'Quantidade Mínima',
      'Unidade',
      'Resultado',
      'Score Similaridade (%)',
      'Justificativa IA',
      'Revisão Humana',
      'Nota de Revisão',
    ].join(',')

    const dataRows = items.map((item) =>
      [
        escapeCSV(item.parcelaServico),
        escapeCSV(item.quantidadeMinima),
        escapeCSV(item.unidade),
        escapeCSV(RESULTADO_LABELS[item.resultado] ?? item.resultado),
        escapeCSV(
          item.scoreSimilaridadeMax
            ? (parseFloat(item.scoreSimilaridadeMax) * 100).toFixed(1)
            : '',
        ),
        escapeCSV(item.aiJustificativa),
        item.humanOverride ? 'Sim' : 'Não',
        escapeCSV(item.humanOverrideNote),
      ].join(','),
    )

    const csv = [...metaRows, header, ...dataRows].join('\n')
    const filename = `cruzamento-${crossingId.slice(0, 8)}-${reportDate.replace(/\//g, '-')}.csv`

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    return reply.send('\uFEFF' + csv) // BOM para Excel reconhecer UTF-8
  })

  // PATCH /api/crossings/:crossingId/items/:itemId/override
  app.patch(
    '/:crossingId/items/:itemId/override',
    { preHandler: requireRole('admin', 'analyst') },
    async (request) => {
      const { crossingId } = CrossingParamsSchema.parse(request.params)
      const { itemId } = z.object({ itemId: z.string().uuid() }).parse(request.params)
      const body = OverrideItemSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())

      const [updated] = await db
        .update(crossingItems)
        .set({
          resultado: body.data.resultado,
          humanOverride: true,
          humanOverrideBy: request.userId,
          humanOverrideNote: body.data.note,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(crossingItems.id, itemId),
            eq(crossingItems.crossingId, crossingId),
            eq(crossingItems.tenantId, request.tenantId),
          ),
        )
        .returning()

      return updated
    },
  )
}
