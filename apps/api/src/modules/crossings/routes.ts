import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { NotFoundError, ValidationError } from '@licitacat/shared/errors'
import { db } from '@licitacat/db'
import { crossings, crossingItems, processingJobs } from '@licitacat/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { crossingQueue } from '@licitacat/queue/queues'

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
      .select()
      .from(crossings)
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

    return db
      .select()
      .from(crossingItems)
      .where(
        and(
          eq(crossingItems.crossingId, crossingId),
          eq(crossingItems.tenantId, request.tenantId),
        ),
      )
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
