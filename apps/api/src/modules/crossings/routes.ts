import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { NotFoundError, ValidationError } from '@licitacat/shared/errors'
import { db } from '@licitacat/db'
import { crossings, crossingItems, crossingItemCats, reqParcelasRelevancia, editais, processingJobs, cats, catItens } from '@licitacat/db/schema'
import { eq, and, desc, sql, count, inArray } from 'drizzle-orm'
import { crossingQueue } from '@licitacat/queue/queues'
import { normalizeToBaseUnit } from '@licitacat/shared/units'
import Redis from 'ioredis'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

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

async function recalcularCrossingStats(crossingId: string, tenantId: string) {
  const rows = await db
    .select({ resultado: crossingItems.resultado, total: count() })
    .from(crossingItems)
    .where(and(eq(crossingItems.crossingId, crossingId), eq(crossingItems.tenantId, tenantId)))
    .groupBy(crossingItems.resultado)

  const atendidos = Number(rows.find(r => r.resultado === 'atendido')?.total ?? 0)
  const parciais  = Number(rows.find(r => r.resultado === 'atendido_parcialmente')?.total ?? 0)
  const gaps      = Number(rows.find(r => r.resultado === 'gap')?.total ?? 0)
  const total = atendidos + parciais + gaps
  const score = total > 0 ? Math.round(((atendidos + parciais * 0.5) / total) * 100) : 0
  const recomendacao = score >= 70 ? 'participar' : score >= 40 ? 'participar_com_ressalvas' : 'nao_participar'

  await db
    .update(crossings)
    .set({
      scoreAderencia: score,
      requisitosAtendidos: atendidos,
      requisitosComRessalva: parciais,
      requisitosGap: gaps,
      recomendacao: recomendacao as 'participar' | 'participar_com_ressalvas' | 'nao_participar',
      updatedAt: new Date(),
    })
    .where(and(eq(crossings.id, crossingId), eq(crossings.tenantId, tenantId)))
}

export async function crossingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /api/crossings — returns one entry per edital (most recent crossing), with total count
  app.get('/', async (request) => {
    // Fetch all crossings with edital info, most recent first
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
        recomendacaoJustificativa: crossings.recomendacaoJustificativa,
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
      .limit(200)

    // Group by editalId, keeping the most recent crossing per edital + total count
    const editalMap = new Map<string, { latest: typeof rows[0]; count: number }>()
    for (const row of rows) {
      const existing = editalMap.get(row.editalId)
      if (!existing) {
        editalMap.set(row.editalId, { latest: row, count: 1 })
      } else {
        existing.count++
        // Keep the most recent (rows are already ordered by createdAt desc)
      }
    }

    const latestIds = Array.from(editalMap.values()).map(({ latest }) => latest.id)
    const pendingCounts = latestIds.length > 0
      ? await db
          .select({ crossingId: crossingItems.crossingId, pendingCount: count() })
          .from(crossingItems)
          .where(and(
            inArray(crossingItems.crossingId, latestIds),
            eq(crossingItems.resultado, 'atendido_parcialmente'),
            eq(crossingItems.humanOverride, false),
          ))
          .groupBy(crossingItems.crossingId)
      : []

    const pendingMap = new Map(pendingCounts.map(p => [p.crossingId, Number(p.pendingCount)]))

    return Array.from(editalMap.values()).map(({ latest, count: totalCrossings }) => ({
      ...latest,
      totalCrossings,
      pendingCount: pendingMap.get(latest.id) ?? 0,
    }))
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

    const [crossing, pendingRows] = await Promise.all([
      db.query.crossings.findFirst({
        where: and(
          eq(crossings.id, crossingId),
          eq(crossings.tenantId, request.tenantId),
        ),
      }),
      db
        .select({ pendingCount: count() })
        .from(crossingItems)
        .where(and(
          eq(crossingItems.crossingId, crossingId),
          eq(crossingItems.tenantId, request.tenantId),
          eq(crossingItems.resultado, 'atendido_parcialmente'),
          eq(crossingItems.humanOverride, false),
        )),
    ])

    if (!crossing) throw new NotFoundError('Crossing', crossingId)
    return { ...crossing, pendingCount: Number(pendingRows[0]?.pendingCount ?? 0) }
  })

  // GET /api/crossings/:crossingId/items
  app.get('/:crossingId/items', async (request) => {
    const { crossingId } = CrossingParamsSchema.parse(request.params)
    const { status } = z.object({ status: z.string().optional() }).parse(request.query)
    const isPendente = status === 'pendente'

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
          ...(isPendente ? [
            eq(crossingItems.resultado, 'atendido_parcialmente'),
            eq(crossingItems.humanOverride, false),
          ] : []),
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
        catDescricaoTecnica: cats.descricaoTecnica,
        catItemDescricao: catItens.descricao,
        catItemQuantidade: catItens.quantidade,
        catItemUnidade: catItens.unidade,
      })
      .from(crossingItemCats)
      .innerJoin(crossingItems, eq(crossingItemCats.crossingItemId, crossingItems.id))
      .innerJoin(cats, eq(crossingItemCats.catId, cats.id))
      .leftJoin(catItens, eq(crossingItemCats.catItemId, catItens.id))
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

    return items.map((item) => {
      const matches = catMatchMap.get(item.id) ?? []

      // Calcular cobertura quantitativa do acervo para o termômetro
      const minQty = item.parcelaQuantidadeMinima ? parseFloat(item.parcelaQuantidadeMinima) : null
      const minNorm = normalizeToBaseUnit(minQty, item.parcelaUnidade)

      let parcelaQuantidadeAcervo: number | null = null
      let parcelaCoberturaPct: number | null = null

      if (minNorm) {
        // Somar quantidades de catItens dos matches que atendem (avaliacao != nao_atende)
        let acervoSum = 0
        for (const m of matches) {
          if (m.avaliacaoLlm === 'nao_atende') continue
          const itemQty = m.catItemQuantidade ? parseFloat(m.catItemQuantidade) : null
          const norm = normalizeToBaseUnit(itemQty, m.catItemUnidade)
          if (norm && norm.baseUnit === minNorm.baseUnit) {
            acervoSum += norm.value
          }
        }
        if (acervoSum > 0) {
          parcelaQuantidadeAcervo = acervoSum
          parcelaCoberturaPct = Math.min(100, Math.round((acervoSum / minNorm.value) * 100))
        }
      }

      return {
        ...item,
        catMatches: matches,
        parcelaQuantidadeAcervo,
        parcelaCoberturaPct,
      }
    })
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

  // GET /api/crossings/:crossingId/stream — SSE real-time updates
  app.get('/:crossingId/stream', async (request, reply) => {
    const { crossingId } = CrossingParamsSchema.parse(request.params)

    // Verify crossing belongs to tenant
    const crossing = await db.query.crossings.findFirst({
      where: and(eq(crossings.id, crossingId), eq(crossings.tenantId, request.tenantId)),
    })
    if (!crossing) throw new NotFoundError('Crossing', crossingId)

    // If already completed/error, send final event immediately
    if (crossing.status === 'completed' || crossing.status === 'error') {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      const evt = crossing.status === 'completed'
        ? JSON.stringify({ type: 'completed', scoreAderencia: crossing.scoreAderencia, recomendacao: crossing.recomendacao })
        : JSON.stringify({ type: 'error', message: 'Processing failed' })
      reply.raw.write(`event: update\ndata: ${evt}\n\n`)
      reply.raw.end()
      return reply
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    reply.raw.flushHeaders?.()

    const subscriber = new Redis(REDIS_URL)
    const channel = `crossing:${crossingId}:updates`

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null

    const cleanup = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      subscriber.unsubscribe(channel).catch(() => {})
      subscriber.quit().catch(() => {})
    }

    subscriber.subscribe(channel, (err) => {
      if (err) {
        reply.raw.write(`event: update\ndata: ${JSON.stringify({ type: 'error', message: 'Subscribe failed' })}\n\n`)
        reply.raw.end()
        cleanup()
      }
    })

    subscriber.on('message', (_ch: string, message: string) => {
      reply.raw.write(`event: update\ndata: ${message}\n\n`)
      // Close connection after completed/error
      try {
        const parsed = JSON.parse(message) as { type: string }
        if (parsed.type === 'completed' || parsed.type === 'error') {
          reply.raw.end()
          cleanup()
        }
      } catch { /* ignore parse errors */ }
    })

    // Heartbeat every 20s to prevent proxy timeout
    heartbeatTimer = setInterval(() => {
      reply.raw.write(': ping\n\n')
    }, 20_000)

    // Cleanup on client disconnect
    request.raw.on('close', cleanup)

    return reply
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

      if (!updated) throw new NotFoundError('CrossingItem', itemId)

      await recalcularCrossingStats(crossingId, request.tenantId)

      return updated
    },
  )
}
