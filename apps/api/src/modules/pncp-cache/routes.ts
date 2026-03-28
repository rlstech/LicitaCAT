import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { ValidationError, NotFoundError } from '@licitacat/shared/errors'
import { pncpSyncQueue } from '@licitacat/queue/queues'
import { db } from '@licitacat/db'
import { pncpSyncConfig } from '@licitacat/db/schema'
import { eq } from 'drizzle-orm'
import {
  PncpCacheBuscarQuerySchema,
  PncpSyncConfigBodySchema,
} from './schema.js'
import {
  searchPncpCache,
  getSyncConfig,
  upsertSyncConfig,
} from './repository.js'

export async function pncpCacheRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)

  // GET /api/pncp-cache/buscar — busca no cache (paginação server-side)
  app.get('/buscar', { preHandler: requireRole('admin', 'analyst') }, async (request) => {
    const query = PncpCacheBuscarQuerySchema.safeParse(request.query)
    if (!query.success) {
      throw new ValidationError('Parâmetros inválidos', query.error.issues)
    }

    const config = await getSyncConfig(request.tenantId)
    if (!config || (config.ufs as string[]).length === 0) {
      return { source: 'live' as const, cacheEmpty: true, data: [], total: 0, page: 1, totalPages: 0 }
    }

    const result = await searchPncpCache(query.data)
    return {
      source: 'cache' as const,
      lastSyncedAt: config.lastSyncedAt,
      lastSyncStatus: config.lastSyncStatus,
      ...result,
      data: result.data.map(row => ({
        anoCompra:            row.anoCompra,
        sequencialCompra:     Number(row.sequencialCompra),
        modalidadeId:         row.codigoModalidade,
        modalidadeNome:       row.modalidadeNome ?? '',
        objetoCompra:         row.objeto ?? '',
        valorTotalEstimado:   row.valorTotalEstimado != null ? Number(row.valorTotalEstimado) : null,
        dataPublicacaoPncp:   row.dataPublicacaoPncp,
        situacaoCompraId:     row.situacaoCompraId ?? null,
        situacaoCompraNome:   row.situacaoCompraNome ?? '',
        linkSistemaOrigem:    row.linkSistemaOrigem ?? null,
        orgaoEntidade: {
          cnpj:        row.cnpjOrgao,
          razaoSocial: row.razaoSocial ?? '',
          nome:        row.razaoSocial ?? '',
          poderId:     '',
          esferaId:    '',
        },
        unidadeOrgao: {
          codigoUnidade: '',
          nomeUnidade:   row.razaoSocial ?? '',
          ufSigla:       row.uf,
          ufNome:        row.uf,
          municipioNome: row.nomeMunicipio ?? '',
        },
      })),
    }
  })

  // GET /api/pncp-cache/config — configuração de sync do tenant
  app.get('/config', async (request) => {
    const config = await getSyncConfig(request.tenantId)
    return config ?? {
      ufs: [],
      modalidades: [],
      retentionDays: 90,
      isActive: false,
      lastSyncedAt: null,
      lastSyncStatus: null,
      recordsSynced: null,
    }
  })

  // PUT /api/pncp-cache/config — salva configuração + registra/remove repeatable job
  app.put('/config', { preHandler: requireRole('admin') }, async (request, reply) => {
    const body = PncpSyncConfigBodySchema.safeParse(request.body)
    if (!body.success) {
      throw new ValidationError('Parâmetros inválidos', body.error.issues)
    }

    const saved = await upsertSyncConfig(request.tenantId, body.data)

    // Registrar ou remover job repetível conforme isActive
    if (body.data.isActive) {
      await pncpSyncQueue.add(
        `pncp_sync_${request.tenantId}`,
        { tenantId: request.tenantId, configId: saved.id, triggeredBy: 'schedule' },
        { repeat: { pattern: '0 */4 * * *' }, jobId: `scheduled_${request.tenantId}` },
      )
    } else {
      try {
        await pncpSyncQueue.removeRepeatableByKey(`pncp_sync_${request.tenantId}`)
      } catch {
        // Ignora se não existe job repetível
      }
    }

    return saved
  })

  // POST /api/pncp-cache/sync — dispara sync manual
  app.post('/sync', { preHandler: requireRole('admin') }, async (request, reply) => {
    const config = await getSyncConfig(request.tenantId)
    if (!config) {
      throw new NotFoundError('PncpSyncConfig', request.tenantId)
    }
    if (config.lastSyncStatus === 'running') {
      return reply.status(409).send({
        error: { code: 'SYNC_ALREADY_RUNNING', message: 'Sincronização já está em andamento.' },
      })
    }

    const bullJob = await pncpSyncQueue.add(
      'pncp_sync_manual',
      { tenantId: request.tenantId, configId: config.id, triggeredBy: 'manual' },
      { priority: 1 },
    )

    await db.update(pncpSyncConfig)
      .set({ lastSyncStatus: 'running', lastSyncJobId: bullJob.id ?? null, updatedAt: new Date() })
      .where(eq(pncpSyncConfig.tenantId, request.tenantId))

    return reply.status(202).send({ jobId: bullJob.id })
  })

  // GET /api/pncp-cache/sync/status — status e progresso do sync
  app.get('/sync/status', async (request) => {
    const config = await getSyncConfig(request.tenantId)
    if (!config) {
      return { status: 'not_configured', progress: 0, lastSyncedAt: null, recordsSynced: null }
    }

    let progress = 0
    if (config.lastSyncJobId && config.lastSyncStatus === 'running') {
      const job = await pncpSyncQueue.getJob(config.lastSyncJobId)
      progress = typeof job?.progress === 'number' ? job.progress : 0
    }

    return {
      status:        config.lastSyncStatus ?? 'idle',
      lastSyncedAt:  config.lastSyncedAt,
      recordsSynced: config.recordsSynced,
      lastSyncError: config.lastSyncError,
      progress,
      ufs:           config.ufs,
      retentionDays: config.retentionDays,
      isActive:      config.isActive,
    }
  })
}
