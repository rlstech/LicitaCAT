import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { NotFoundError, ValidationError } from '@licitacat/shared/errors'
import {
  ListEditaisQuerySchema,
  EditalParamsSchema,
  RequisitoParamsSchema,
  UpdateEditalSchema,
  UpdateRequisitoSchema,
} from './schema.js'
import {
  listEditais,
  findEditalById,
  updateEdital,
  listRequisitos,
  updateRequisito,
} from './repository.js'
import { ocrQueue } from '@licitacat/queue/queues'
import { db } from '@licitacat/db'
import { processingJobs } from '@licitacat/db/schema'

export async function editaisRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', requireAuth)

  // GET /api/editais
  app.get('/', async (request) => {
    const query = ListEditaisQuerySchema.parse(request.query)
    return listEditais(request.tenantId, query.page, query.limit, query.status)
  })

  // GET /api/editais/:editalId
  app.get('/:editalId', async (request) => {
    const { editalId } = EditalParamsSchema.parse(request.params)
    const edital = await findEditalById(request.tenantId, editalId)
    if (!edital) throw new NotFoundError('Edital', editalId)
    return edital
  })

  // PATCH /api/editais/:editalId
  app.patch(
    '/:editalId',
    { preHandler: requireRole('admin', 'analyst') },
    async (request) => {
      const { editalId } = EditalParamsSchema.parse(request.params)
      const body = UpdateEditalSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())

      const existing = await findEditalById(request.tenantId, editalId)
      if (!existing) throw new NotFoundError('Edital', editalId)

      return updateEdital(request.tenantId, editalId, body.data)
    },
  )

  // GET /api/editais/:editalId/requisitos
  app.get('/:editalId/requisitos', async (request) => {
    const { editalId } = EditalParamsSchema.parse(request.params)
    const edital = await findEditalById(request.tenantId, editalId)
    if (!edital) throw new NotFoundError('Edital', editalId)
    return listRequisitos(request.tenantId, editalId)
  })

  // PATCH /api/editais/:editalId/requisitos/:requisitoId
  app.patch(
    '/:editalId/requisitos/:requisitoId',
    { preHandler: requireRole('admin', 'analyst') },
    async (request) => {
      const { editalId, requisitoId } = RequisitoParamsSchema.parse(request.params)
      const body = UpdateRequisitoSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())

      return updateRequisito(request.tenantId, requisitoId, body.data, request.userId)
    },
  )

  // POST /api/editais/:editalId/reprocess-ocr
  app.post(
    '/:editalId/reprocess-ocr',
    { preHandler: requireRole('admin') },
    async (request) => {
      const { editalId } = EditalParamsSchema.parse(request.params)
      const edital = await findEditalById(request.tenantId, editalId)
      if (!edital) throw new NotFoundError('Edital', editalId)

      const [job] = await db
        .insert(processingJobs)
        .values({
          tenantId: request.tenantId,
          jobType: 'ocr',
          entityType: 'edital',
          entityId: editalId,
          status: 'queued',
        })
        .returning()

      if (!job) throw new Error('Failed to create job')

      await ocrQueue.add('ocr', {
        tenantId: request.tenantId,
        editalId,
        jobId: job.id,
        fileUrl: edital.fileUrl,
      })

      return { jobId: job.id, status: 'queued' }
    },
  )
}
