import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { NotFoundError, ValidationError } from '@licitacat/shared/errors'
import {
  ListEditaisQuerySchema,
  EditalParamsSchema,
  UpdateEditalSchema,
} from './schema.js'
import {
  listEditais,
  findEditalById,
  updateEdital,
  deleteEdital,
  findEditalHabilitacao,
} from './repository.js'
import { editalExtractionQueue } from '@licitacat/queue/queues'
import { db } from '@licitacat/db'
import { editais, processingJobs } from '@licitacat/db/schema'
import { eq, and } from 'drizzle-orm'

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

  // DELETE /api/editais/:editalId
  app.delete(
    '/:editalId',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const { editalId } = EditalParamsSchema.parse(request.params)
      const edital = await findEditalById(request.tenantId, editalId)
      if (!edital) throw new NotFoundError('Edital', editalId)

      await deleteEdital(request.tenantId, editalId)
      return reply.status(204).send()
    },
  )

  // GET /api/editais/:editalId/habilitacao — structured habilitação data
  app.get('/:editalId/habilitacao', async (request) => {
    const { editalId } = EditalParamsSchema.parse(request.params)
    const edital = await findEditalById(request.tenantId, editalId)
    if (!edital) throw new NotFoundError('Edital', editalId)
    return findEditalHabilitacao(request.tenantId, editalId)
  })

  // POST /api/editais/:editalId/approve — set status to ready
  app.post(
    '/:editalId/approve',
    { preHandler: requireRole('admin', 'analyst') },
    async (request) => {
      const { editalId } = EditalParamsSchema.parse(request.params)
      const edital = await findEditalById(request.tenantId, editalId)
      if (!edital) throw new NotFoundError('Edital', editalId)

      const [updated] = await db
        .update(editais)
        .set({ status: 'ready', updatedAt: new Date() })
        .where(and(eq(editais.id, editalId), eq(editais.tenantId, request.tenantId)))
        .returning()

      return updated
    },
  )

  // POST /api/editais/:editalId/reprocess — re-enqueue edital extraction
  app.post(
    '/:editalId/reprocess',
    { preHandler: requireRole('admin') },
    async (request) => {
      const { editalId } = EditalParamsSchema.parse(request.params)
      const edital = await findEditalById(request.tenantId, editalId)
      if (!edital) throw new NotFoundError('Edital', editalId)

      await db
        .update(editais)
        .set({ status: 'uploaded' })
        .where(eq(editais.id, editalId))

      const [job] = await db
        .insert(processingJobs)
        .values({
          tenantId: request.tenantId,
          jobType: 'edital_extraction',
          entityType: 'edital',
          entityId: editalId,
          status: 'queued',
        })
        .returning()

      if (!job) throw new Error('Failed to create job')

      await editalExtractionQueue.add('edital_extraction', {
        tenantId: request.tenantId,
        editalId,
        jobId: job.id,
        fileUrl: edital.fileUrl,
      })

      return { jobId: job.id, status: 'queued' }
    },
  )
}
