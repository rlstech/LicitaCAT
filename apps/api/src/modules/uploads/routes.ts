import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { ValidationError, TenantLimitError } from '@licitacat/shared/errors'
import { uploadToS3, buildS3Key } from '@licitacat/ai/storage'
import { db } from '@licitacat/db'
import { editais, cats, tenants, processingJobs } from '@licitacat/db/schema'
import { eq, count, and, gte } from 'drizzle-orm'
import { editalExtractionQueue, catExtractionQueue } from '@licitacat/queue/queues'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'module'
const _require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pdfParse = _require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

async function detectPdfType(buffer: Buffer): Promise<'pdf_copyable' | 'pdf_scanned'> {
  try {
    const { text } = await pdfParse(buffer.slice(0, 200_000)) // sample first ~200KB
    return text.trim().length > 100 ? 'pdf_copyable' : 'pdf_scanned'
  } catch {
    return 'pdf_scanned'
  }
}

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

    // Consume the file stream FIRST to prevent ECONNRESET when validation fails
    // (Node.js closes the TCP connection if the request body is not consumed)
    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)

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
          jobType: 'edital_extraction',
          entityType: 'edital',
          entityId: edital.id,
          status: 'queued',
        })
        .returning()

      if (!job) throw new Error('Failed to create job')

      await editalExtractionQueue.add('edital_extraction', {
        tenantId: request.tenantId,
        editalId: edital.id,
        jobId: job.id,
        fileUrl,
      })

      return reply.status(201).send({ editalId: edital.id, jobId: job.id })
    } else {
      const fileType = mimeType === 'application/pdf'
        ? await detectPdfType(buffer)
        : 'excel'

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
      }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })

      return reply.status(201).send({ catId: cat.id, jobId: job.id })
    }
  })

  // POST /api/uploads/reprocess-cat/:catId — re-enqueue extraction for a CAT in error state
  app.post('/reprocess-cat/:catId', async (request, reply) => {
    const { catId } = (request.params as { catId: string })

    const cat = await db.query.cats.findFirst({
      where: and(eq(cats.id, catId), eq(cats.tenantId, request.tenantId)),
    })

    if (!cat) throw new ValidationError('CAT não encontrada')
    if (!['error', 'pending'].includes(cat.statusExtracao)) {
      throw new ValidationError(`CAT com status "${cat.statusExtracao}" não pode ser reprocessada`)
    }

    await db.update(cats).set({ statusExtracao: 'pending' }).where(eq(cats.id, catId))

    const [job] = await db
      .insert(processingJobs)
      .values({
        tenantId: request.tenantId,
        jobType: 'cat_extraction',
        entityType: 'cat',
        entityId: catId,
        status: 'queued',
      })
      .returning()

    if (!job) throw new Error('Failed to create job')

    await catExtractionQueue.add('cat_extraction', {
      tenantId: request.tenantId,
      catId,
      jobId: job.id,
      fileUrl: cat.fileUrl,
      fileType: cat.fileType as 'pdf_scanned' | 'pdf_copyable' | 'excel',
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })

    return reply.status(202).send({ catId, jobId: job.id, status: 'queued' })
  })

  // POST /api/uploads/reprocess/:editalId — re-enqueue OCR for an edital in error/uploaded state
  app.post('/reprocess/:editalId', async (request, reply) => {
    const { editalId } = (request.params as { editalId: string })

    const edital = await db.query.editais.findFirst({
      where: and(eq(editais.id, editalId), eq(editais.tenantId, request.tenantId)),
    })

    if (!edital) throw new ValidationError('Edital não encontrado')
    if (!['error', 'uploaded'].includes(edital.status)) {
      throw new ValidationError(`Edital com status "${edital.status}" não pode ser reprocessado`)
    }

    await db.update(editais).set({ status: 'uploaded' }).where(eq(editais.id, editalId))

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

    return reply.status(202).send({ editalId, jobId: job.id, status: 'queued' })
  })
}
