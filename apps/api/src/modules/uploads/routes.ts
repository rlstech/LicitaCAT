import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { ValidationError, TenantLimitError } from '@licitacat/shared/errors'
import { UploadRequestSchema, ALLOWED_MIME_TYPES } from '@licitacat/shared/schemas'
import { generatePresignedUploadUrl, buildS3Key } from '@licitacat/ai/storage'
import { db } from '@licitacat/db'
import { editais, cats, tenants, processingJobs } from '@licitacat/db/schema'
import { eq, count, and, gte } from 'drizzle-orm'
import { ocrQueue, catExtractionQueue } from '@licitacat/queue/queues'
import { randomUUID } from 'node:crypto'

export async function uploadsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireRole('admin', 'analyst'))

  // POST /api/uploads/presign — get a pre-signed upload URL
  app.post('/presign', async (request, reply) => {
    const body = UploadRequestSchema.safeParse(request.body)
    if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())

    const { fileName, mimeType, fileSize, entityType } = body.data

    // Check tenant limits for editais
    if (entityType === 'edital') {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, request.tenantId),
      })

      if (tenant) {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const [result] = await db
          .select({ count: count() })
          .from(editais)
          .where(
            and(
              eq(editais.tenantId, request.tenantId),
              gte(editais.createdAt, startOfMonth),
            ),
          )

        if ((result?.count ?? 0) >= tenant.maxEditaisPerMonth) {
          throw new TenantLimitError('editais_per_month')
        }
      }
    }

    const entityId = randomUUID()
    const s3Key = buildS3Key(request.tenantId, entityType, entityId, fileName)

    const presignedUrl = await generatePresignedUploadUrl(s3Key, mimeType, fileSize)

    return reply.status(200).send({
      presignedUrl,
      s3Key,
      entityId,
    })
  })

  // POST /api/uploads/confirm — confirm upload and create entity + job
  app.post('/confirm', async (request, reply) => {
    const body = (
      request.body as {
        entityType: 'edital' | 'cat'
        entityId: string
        s3Key: string
        fileName: string
        mimeType: string
        profissionalId?: string
      }
    )

    if (!body.entityType || !body.entityId || !body.s3Key || !body.fileName) {
      throw new ValidationError('Missing required fields')
    }

    if (!ALLOWED_MIME_TYPES.includes(body.mimeType as typeof ALLOWED_MIME_TYPES[number])) {
      throw new ValidationError(`Invalid MIME type: ${body.mimeType}`)
    }

    const fileUrl = `s3://${process.env['S3_BUCKET']}/${body.s3Key}`

    if (body.entityType === 'edital') {
      const [edital] = await db
        .insert(editais)
        .values({
          id: body.entityId,
          tenantId: request.tenantId,
          uploadedBy: request.userId,
          fileName: body.fileName,
          fileUrl,
          status: 'uploaded',
        })
        .returning()

      if (!edital) throw new Error('Failed to create edital')

      const [job] = await db
        .insert(processingJobs)
        .values({
          tenantId: request.tenantId,
          jobType: 'ocr',
          entityType: 'edital',
          entityId: edital.id,
          status: 'queued',
        })
        .returning()

      if (!job) throw new Error('Failed to create job')

      await ocrQueue.add('ocr', {
        tenantId: request.tenantId,
        editalId: edital.id,
        jobId: job.id,
        fileUrl,
      })

      return reply.status(201).send({ editalId: edital.id, jobId: job.id })
    } else {
      if (!body.profissionalId) {
        throw new ValidationError('profissionalId is required for CAT uploads')
      }

      const fileType = body.mimeType === 'application/pdf' ? 'pdf_scanned' : 'excel'

      const [cat] = await db
        .insert(cats)
        .values({
          id: body.entityId,
          tenantId: request.tenantId,
          profissionalId: body.profissionalId,
          uploadedBy: request.userId,
          fileName: body.fileName,
          fileUrl,
          fileType,
          statusExtracao: 'pending',
        })
        .returning()

      if (!cat) throw new Error('Failed to create cat')

      const [job] = await db
        .insert(processingJobs)
        .values({
          tenantId: request.tenantId,
          jobType: 'cat_extraction',
          entityType: 'cat',
          entityId: cat.id,
          status: 'queued',
        })
        .returning()

      if (!job) throw new Error('Failed to create job')

      await catExtractionQueue.add('cat_extraction', {
        tenantId: request.tenantId,
        catId: cat.id,
        jobId: job.id,
        fileUrl,
        fileType,
      })

      return reply.status(201).send({ catId: cat.id, jobId: job.id })
    }
  })
}
