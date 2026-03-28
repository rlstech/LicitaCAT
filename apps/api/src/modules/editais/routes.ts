import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { NotFoundError, ValidationError } from '@licitacat/shared/errors'
import {
  ListEditaisQuerySchema,
  EditalParamsSchema,
  UpdateEditalSchema,
  PncpBuscarQuerySchema,
  PncpDetalheQuerySchema,
  PncpImportarBodySchema,
} from './schema.js'
import {
  listEditais,
  findEditalById,
  updateEdital,
  deleteEdital,
  findEditalHabilitacao,
} from './repository.js'
import { searchPncp, getPncpDetalhe, getPncpItens, getPncpArquivos, mapPncpToEditalData, downloadPncpFile, isZipBuffer, findMainArquivo } from './pncp.service.js'
import { editalExtractionQueue, embeddingGenQueue } from '@licitacat/queue/queues'
import { db } from '@licitacat/db'
import { editais, processingJobs } from '@licitacat/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { uploadToS3, buildS3Key } from '@licitacat/ai/storage'
import { createRequire } from 'node:module'

export async function editaisRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', requireAuth)

  // GET /api/editais/pncp/buscar — proxy busca no PNCP
  app.get(
    '/pncp/buscar',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const query = PncpBuscarQuerySchema.safeParse(request.query)
      if (!query.success) throw new ValidationError('Parâmetros inválidos', query.error.flatten())

      try {
        const ufs = query.data.ufs
          ? query.data.ufs.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length === 2)
          : undefined
        const result = await searchPncp({ ...query.data, ufs })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao consultar PNCP'
        return reply.status(502).send({ error: { code: 'PNCP_ERROR', message } })
      }
    },
  )

  // GET /api/editais/pncp/detalhe — buscar detalhes de uma contratação no PNCP
  app.get(
    '/pncp/detalhe',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const query = PncpDetalheQuerySchema.safeParse(request.query)
      if (!query.success) throw new ValidationError('Parâmetros inválidos', query.error.flatten())

      try {
        const detalhe = await getPncpDetalhe(query.data.cnpj, query.data.ano, query.data.sequencial)
        return detalhe
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao consultar PNCP'
        return reply.status(502).send({ error: { code: 'PNCP_ERROR', message } })
      }
    },
  )

  // GET /api/editais/pncp/itens — buscar itens de uma contratação no PNCP
  app.get(
    '/pncp/itens',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const query = PncpDetalheQuerySchema.safeParse(request.query)
      if (!query.success) throw new ValidationError('Parâmetros inválidos', query.error.flatten())

      try {
        const itens = await getPncpItens(query.data.cnpj, query.data.ano, query.data.sequencial)
        return itens
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao consultar PNCP'
        return reply.status(502).send({ error: { code: 'PNCP_ERROR', message } })
      }
    },
  )

  // GET /api/editais/pncp/arquivos — buscar arquivos de uma contratação no PNCP
  app.get(
    '/pncp/arquivos',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const query = PncpDetalheQuerySchema.safeParse(request.query)
      if (!query.success) throw new ValidationError('Parâmetros inválidos', query.error.flatten())

      try {
        const arquivos = await getPncpArquivos(query.data.cnpj, query.data.ano, query.data.sequencial)
        return arquivos
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao consultar PNCP'
        return reply.status(502).send({ error: { code: 'PNCP_ERROR', message } })
      }
    },
  )

  // POST /api/editais/pncp/importar — importar edital do PNCP
  app.post(
    '/pncp/importar',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const body = PncpImportarBodySchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Dados inválidos', body.error.flatten())

      const editalData = mapPncpToEditalData(body.data)

      const [created] = await db
        .insert(editais)
        .values({
          tenantId: request.tenantId,
          uploadedBy: request.userId,
          ...editalData,
          status: 'uploaded',
        })
        .returning()

      if (!created) throw new Error('Falha ao criar edital')

      // Tentar baixar o PDF/ZIP do PNCP e enfileirar extração
      let jobId: string | undefined
      try {
        const cnpj = body.data.orgaoEntidade?.cnpj
        const ano = body.data.anoCompra
        const sequencial = body.data.sequencialCompra

        if (!cnpj) throw new Error('CNPJ do órgão não disponível para buscar arquivos')

        const arquivos = await getPncpArquivos(cnpj, ano, sequencial)
        const arquivo = findMainArquivo(arquivos)

        if (arquivo) {
          let fileBuffer = await downloadPncpFile(arquivo.url)
          let fileName = `${arquivo.titulo || 'edital'}.pdf`

          // Extrair PDF do ZIP se necessário (detectado via magic bytes PK)
          if (isZipBuffer(fileBuffer)) {
            const _require = createRequire(import.meta.url)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
            const AdmZip = _require('adm-zip')
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const zip = new AdmZip(fileBuffer)
            const pdfEntries = (zip.getEntries() as Array<{ entryName: string }>)
              .filter(e => e.entryName.toLowerCase().endsWith('.pdf'))
            if (pdfEntries.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
              const extracted = zip.readFile(pdfEntries[0]) as Buffer | null
              if (extracted) {
                fileBuffer = extracted
                fileName = pdfEntries[0].entryName.split('/').pop() ?? fileName
              }
            }
          }

          const s3Key = buildS3Key(request.tenantId, 'edital', created.id, fileName)
          const fileUrl = await uploadToS3(s3Key, fileBuffer, 'application/pdf')

          await db.update(editais)
            .set({ fileUrl, fileName })
            .where(eq(editais.id, created.id))

          const [job] = await db
            .insert(processingJobs)
            .values({
              tenantId: request.tenantId,
              jobType: 'edital_extraction',
              entityType: 'edital',
              entityId: created.id,
              status: 'queued',
            })
            .returning()

          if (job) {
            jobId = job.id
            await editalExtractionQueue.add('edital_extraction', {
              tenantId: request.tenantId,
              editalId: created.id,
              jobId: job.id,
              fileUrl,
            })
          }
        }
      } catch (err) {
        request.log.warn({ err, editalId: created.id }, 'Falha ao baixar arquivo do PNCP — edital criado sem PDF')
      }

      return reply.status(201).send({ editalId: created.id, ...(jobId ? { jobId } : {}) })
    },
  )

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

  // POST /api/editais/rebuild-embeddings — re-queue embedding gen for all NULL-embedding parcelas
  app.post(
    '/rebuild-embeddings',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const tenantId = request.tenantId

      const parcelasWithNull = await db.execute<{ id: string; servico: string }>(
        sql`SELECT id, servico FROM req_parcelas_relevancia WHERE tenant_id = ${tenantId} AND embedding IS NULL AND servico IS NOT NULL`
      )

      let queued = 0

      for (const parcela of parcelasWithNull.rows) {
        const [job] = await db.insert(processingJobs).values({
          tenantId,
          jobType: 'embedding_gen',
          entityType: 'parcela_relevancia',
          entityId: parcela.id,
          status: 'queued',
        }).returning()
        if (job) {
          await embeddingGenQueue.add('embedding_gen', {
            tenantId,
            entityType: 'parcela_relevancia',
            entityId: parcela.id,
            text: parcela.servico,
            jobId: job.id,
          })
          queued++
        }
      }

      return reply.status(202).send({ queued })
    },
  )
}
