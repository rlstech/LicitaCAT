import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { ValidationError, TenantLimitError } from '@licitacat/shared/errors'
import { uploadToS3, buildS3Key } from '@licitacat/ai/storage'
import { db } from '@licitacat/db'
import { editais, cats, tenants, processingJobs } from '@licitacat/db/schema'
import { eq, count, and, gte } from 'drizzle-orm'
import { ocrQueue, catExtractionQueue } from '@licitacat/queue/queues'
import { randomUUID } from 'node:crypto'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

export async function uploadsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireRole('admin', 'analyst'))

  // POST /api/uploads/file — multipart upload (file sent directly to API → MinIO internally)
  app.post('/file', async (request, reply) => {
    const data = await request.file()
    if (!data) throw new ValidationError('No file provided')

    const entityType = data.fields['entityType'] as { value: string } | undefined
    const profissionalId = data.fields['profissionalId'] as { value: string } | undefined

    if (!entityType?.value || !['edital', 'cat'].includes(entityType.value)) {
      throw new ValidationError('entityType must be "edital" or "cat"')
    }

    const mimeType = data.mimetype
    if (!ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number])) {
      throw new ValidationError(`Tipo de arquivo não permitido: ${mimeType}`)
    }

    const type = entityType.value as 'edital' | 'cat'

    // Check tenant limits for editais
    if (type === 'edital') {
      const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, request.tenantId) })
      if (tenant) {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        const [result] = await db
          .select({ count: count() })
          .from(editais)
          .where(and(eq(editais.tenantId, request.tenantId), gte(editais.createdAt, startOfMonth)))
        if ((result?.count ?? 0) >= tenant.maxEditaisPerMonth) {
          throw new TenantLimitError('editais_per_month')
        }
      }
    }

    if (type === 'cat' && !profissionalId?.value) {
      throw new ValidationError('profissionalId é obrigatório para upload de CAT')
    }

    // Read file buffer and upload to MinIO internally
    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)

    const entityId = randomUUID()
    const s3Key = buildS3Key(request.tenantId, type, entityId, data.filename)
    const fileUrl = await uploadToS3(s3Key, buffer, mimeType)

    if (type === 'edital') {
      const [edital] = await db
        .insert(editais)
        .values({
          id: entityId,
          tenantId: request.tenantId,
          uploadedBy: request.userId,
          fileName: data.filename,
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
      const fileType = mimeType === 'application/pdf' ? 'pdf_scanned' : 'excel'

      const [cat] = await db
        .insert(cats)
        .values({
          id: entityId,
          tenantId: request.tenantId,
          profissionalId: profissionalId!.value,
          uploadedBy: request.userId,
          fileName: data.filename,
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
