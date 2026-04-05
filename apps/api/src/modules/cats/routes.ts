import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { NotFoundError, ValidationError } from '@licitacat/shared/errors'
import { generateEmbedding } from '@licitacat/ai/embeddings'
import { callLlm, createLlmCache, callLlmWithCache } from '@licitacat/ai/llm'
import { CAT_CHAT_SYSTEM_PROMPT, buildCatChatContext, type CatContextItem } from '@licitacat/ai/prompts'
import {
  CatParamsSchema,
  CatItemParamsSchema,
  ProfissionalParamsSchema,
  ListCatsQuerySchema,
  CreateProfissionalSchema,
  UpdateProfissionalSchema,
  CreateCatItemSchema,
  UpdateCatItemSchema,
  UpdateCatSchema,
} from './schema.js'
import {
  listProfissionais,
  createProfissional,
  updateProfissional,
  listCats,
  findCatById,
  updateCat,
  deleteCat,
  listCatItens,
  createCatItem,
  updateCatItem,
  deleteCatItem,
  searchCatItens,
  normalizeCatItensDescriptions,
} from './repository.js'
import { db } from '@licitacat/db'
import { processingJobs } from '@licitacat/db/schema'
import { sql } from 'drizzle-orm'
import { embeddingGenQueue } from '@licitacat/queue/queues'
import { z } from 'zod'

export async function catsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // Profissionais
  app.get('/profissionais', async (request) => {
    return listProfissionais(request.tenantId)
  })

  app.post(
    '/profissionais',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const body = CreateProfissionalSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())
      const created = await createProfissional(request.tenantId, body.data)
      return reply.status(201).send(created)
    },
  )

  app.patch(
    '/profissionais/:profissionalId',
    { preHandler: requireRole('admin', 'analyst') },
    async (request) => {
      const { profissionalId } = ProfissionalParamsSchema.parse(request.params)
      const body = UpdateProfissionalSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())
      return updateProfissional(request.tenantId, profissionalId, body.data)
    },
  )

  // GET /api/cats/search — busca itens em todas as cats (ou específica)
  app.get('/search', async (request) => {
    const { q, catId } = z.object({
      q: z.string().min(2).max(200),
      catId: z.string().uuid().optional(),
    }).parse(request.query)
    return searchCatItens(request.tenantId, q, catId)
  })

  // POST /api/cats/normalize-descriptions — normaliza descrições/unidades (sentence case)
  app.post(
    '/normalize-descriptions',
    { preHandler: requireRole('admin', 'analyst') },
    async (_request, reply) => {
      const result = await normalizeCatItensDescriptions(_request.tenantId)
      return reply.status(200).send(result)
    },
  )

  // CATs
  app.get('/', async (request) => {
    const query = ListCatsQuerySchema.parse(request.query)
    return listCats(
      request.tenantId,
      query.page,
      query.limit,
      query.profissionalId,
      query.ativo,
    )
  })

  app.get('/:catId', async (request) => {
    const { catId } = CatParamsSchema.parse(request.params)
    const cat = await findCatById(request.tenantId, catId)
    if (!cat) throw new NotFoundError('CAT', catId)
    return cat
  })

  app.patch(
    '/:catId',
    { preHandler: requireRole('admin', 'analyst') },
    async (request) => {
      const { catId } = CatParamsSchema.parse(request.params)
      const body = UpdateCatSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())
      const existing = await findCatById(request.tenantId, catId)
      if (!existing) throw new NotFoundError('CAT', catId)
      return updateCat(request.tenantId, catId, body.data)
    },
  )

  app.delete(
    '/:catId',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const { catId } = CatParamsSchema.parse(request.params)
      const existing = await findCatById(request.tenantId, catId)
      if (!existing) throw new NotFoundError('CAT', catId)
      await deleteCat(request.tenantId, catId)
      return reply.status(204).send()
    },
  )

  // CAT Itens
  app.get('/:catId/itens', async (request) => {
    const { catId } = CatParamsSchema.parse(request.params)
    const cat = await findCatById(request.tenantId, catId)
    if (!cat) throw new NotFoundError('CAT', catId)
    return listCatItens(request.tenantId, catId)
  })

  app.post(
    '/:catId/itens',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const { catId } = CatParamsSchema.parse(request.params)
      const body = CreateCatItemSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())
      const cat = await findCatById(request.tenantId, catId)
      if (!cat) throw new NotFoundError('CAT', catId)
      const created = await createCatItem(request.tenantId, catId, body.data)
      return reply.status(201).send(created)
    },
  )

  app.patch(
    '/:catId/itens/:itemId',
    { preHandler: requireRole('admin', 'analyst') },
    async (request) => {
      const { itemId } = CatItemParamsSchema.parse(request.params)
      const body = UpdateCatItemSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())
      return updateCatItem(request.tenantId, itemId, body.data)
    },
  )

  app.delete(
    '/:catId/itens/:itemId',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const { itemId } = CatItemParamsSchema.parse(request.params)
      await deleteCatItem(request.tenantId, itemId)
      return reply.status(204).send()
    },
  )

  // GET /api/cats/embeddings-status — progresso de geração de embeddings
  app.get('/embeddings-status', async (request) => {
    const tenantId = request.tenantId

    const statsResult = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM cats WHERE tenant_id = ${tenantId} AND ativo = true) AS total_cats,
        (SELECT COUNT(*) FROM cats WHERE tenant_id = ${tenantId} AND ativo = true AND embedding IS NOT NULL) AS cats_with_embedding,
        (SELECT COUNT(*) FROM cat_itens WHERE tenant_id = ${tenantId}) AS total_items,
        (SELECT COUNT(*) FROM cat_itens WHERE tenant_id = ${tenantId} AND embedding IS NOT NULL) AS items_with_embedding
    `)
    const statsRows = Array.from(statsResult as unknown as Iterable<unknown>)
    const stats = (statsRows[0] ?? {}) as Record<string, unknown>

    const jobsResult = await db.execute(sql`
      SELECT status, COUNT(*) AS count
      FROM processing_jobs
      WHERE tenant_id = ${tenantId} AND job_type = 'embedding_gen'
        AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY status
    `)
    const jobRows = Array.from(jobsResult as unknown as Iterable<unknown>)
    const jobCounts: Record<string, number> = {}
    for (const row of jobRows) {
      const r = row as Record<string, unknown>
      jobCounts[String(r['status'])] = Number(r['count'])
    }

    const totalCats = Number(stats['total_cats'] ?? 0)
    const catsWithEmbedding = Number(stats['cats_with_embedding'] ?? 0)
    const totalItems = Number(stats['total_items'] ?? 0)
    const itemsWithEmbedding = Number(stats['items_with_embedding'] ?? 0)

    const totalAll = totalCats + totalItems
    const doneAll = catsWithEmbedding + itemsWithEmbedding
    const progressPercent = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0

    const queued = jobCounts['queued'] ?? 0
    const running = jobCounts['running'] ?? 0
    const isProcessing = queued > 0 || running > 0

    return {
      totalCats,
      catsWithEmbedding,
      totalItems,
      itemsWithEmbedding,
      totalAll,
      doneAll,
      progressPercent,
      isProcessing,
      jobs: {
        queued,
        running,
        completed: jobCounts['completed'] ?? 0,
        failed: jobCounts['failed'] ?? 0,
      },
    }
  })

  // POST /api/cats/rebuild-embeddings — re-queue embedding generation for all NULL-embedding cats/cat_itens
  app.post(
    '/rebuild-embeddings',
    { preHandler: requireRole('admin', 'analyst') },
    async (request, reply) => {
      const tenantId = request.tenantId

      const catsResult = await db.execute(
        sql`SELECT id, descricao_tecnica FROM cats WHERE tenant_id = ${tenantId} AND embedding IS NULL AND ativo = true AND descricao_tecnica IS NOT NULL`
      )
      const catsWithNull = Array.from(catsResult as unknown as Iterable<unknown>) as Array<{ id: string; descricao_tecnica: string }>

      const itemsResult = await db.execute(
        sql`SELECT id, descricao FROM cat_itens WHERE tenant_id = ${tenantId} AND embedding IS NULL`
      )
      const itemsWithNull = Array.from(itemsResult as unknown as Iterable<unknown>) as Array<{ id: string; descricao: string }>

      let queued = 0

      for (const cat of catsWithNull) {
        const [job] = await db.insert(processingJobs).values({
          tenantId,
          jobType: 'embedding_gen',
          entityType: 'cat',
          entityId: cat.id,
          status: 'queued',
        }).returning()
        if (job) {
          await embeddingGenQueue.add('embedding_gen', {
            tenantId,
            entityType: 'cat',
            entityId: cat.id,
            text: cat.descricao_tecnica,
            jobId: job.id,
          })
          queued++
        }
      }

      for (const item of itemsWithNull) {
        const [job] = await db.insert(processingJobs).values({
          tenantId,
          jobType: 'embedding_gen',
          entityType: 'cat_item',
          entityId: item.id,
          status: 'queued',
        }).returning()
        if (job) {
          await embeddingGenQueue.add('embedding_gen', {
            tenantId,
            entityType: 'cat_item',
            entityId: item.id,
            text: item.descricao,
            jobId: job.id,
          })
          queued++
        }
      }

      return reply.status(202).send({ queued, cats: catsWithNull.length, catItems: itemsWithNull.length })
    },
  )

  // ── Chat RAG ──────────────────────────────────────────────────────────────
  const ChatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    history: z
      .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
      .max(20)
      .default([]),
    cacheName: z.string().nullable().optional(),
  })

  app.post('/chat', async (request, reply) => {
    const parsed = ChatRequestSchema.safeParse(request.body)
    if (!parsed.success) throw new ValidationError('Invalid body', parsed.error.flatten())
    const { message, history, cacheName: rawCache } = parsed.data
    const incomingCache = rawCache ?? undefined
    const { tenantId } = request

    // 1. Embedding da query
    const { embedding } = await generateEmbedding(message, 'query')
    const vectorStr = `[${embedding.join(',')}]`

    // 2. Busca semântica (pgvector)
    const semanticRows = await db.execute(sql`
      SELECT c.id, c.numero_cat, c.empresa_contratante, c.tipo_obra_servico, c.descricao_tecnica,
             1 - (c.embedding <=> ${vectorStr}::vector) AS score
      FROM cats c
      WHERE c.tenant_id = ${tenantId}
        AND c.ativo = true
        AND c.embedding IS NOT NULL
        AND c.embedding_model = 'gemini-embedding-2-preview'
        AND c.status_extracao IN ('review_pending', 'completed')
      ORDER BY score DESC
      LIMIT 15
    `)

    // 3. Busca FTS (tsvector)
    const ftsRows = await db.execute(sql`
      SELECT DISTINCT c.id, c.numero_cat, c.empresa_contratante, c.tipo_obra_servico, c.descricao_tecnica,
             ts_rank_cd(c.search_vector, plainto_tsquery('portuguese', immutable_unaccent(${message}))) AS rank
      FROM cats c
      WHERE c.tenant_id = ${tenantId}
        AND c.ativo = true
        AND c.search_vector @@ plainto_tsquery('portuguese', immutable_unaccent(${message}))
      ORDER BY rank DESC
      LIMIT 15
    `)

    // 4. Merge via RRF
    type CatRow = {
      id: string
      numero_cat: string | null
      empresa_contratante: string | null
      tipo_obra_servico: string | null
      descricao_tecnica: string | null
    }
    const semanticArr = Array.from(semanticRows as unknown as Iterable<CatRow>)
    const ftsArr = Array.from(ftsRows as unknown as Iterable<CatRow>)

    const RRF_K = 60
    const semMap = new Map<string, number>()
    semanticArr.forEach((r, i) => semMap.set(r.id, i + 1))
    const ftsMap = new Map<string, number>()
    ftsArr.forEach((r, i) => ftsMap.set(r.id, i + 1))

    const allRows = new Map<string, CatRow>()
    for (const r of [...semanticArr, ...ftsArr]) {
      if (!allRows.has(r.id)) allRows.set(r.id, r)
    }

    const ranked = Array.from(allRows.entries())
      .map(([id, row]) => {
        const s = semMap.get(id)
        const f = ftsMap.get(id)
        const rrf = (s ? 1 / (RRF_K + s) : 0) + (f ? 1 / (RRF_K + f) : 0)
        return { row, rrf }
      })
      .sort((a, b) => b.rrf - a.rrf)
      .slice(0, 10)
      .map(({ row }) => row)

    const contextCats: CatContextItem[] = ranked.map((r) => ({
      id: r.id,
      numeroCat: r.numero_cat,
      empresaContratante: r.empresa_contratante,
      tipoObraServico: r.tipo_obra_servico,
      descricaoTecnica: r.descricao_tecnica,
    }))

    // 5. Montar system prompt com contexto RAG
    const contextBlock = buildCatChatContext(contextCats)
    const systemPrompt = CAT_CHAT_SYSTEM_PROMPT.replace('{CONTEXT_BLOCK}', contextBlock)

    const messages = [...history, { role: 'user' as const, content: message }]

    // 6. Chamar Gemini (com cache se disponível, senão chamada normal)
    let responseText: string
    if (incomingCache) {
      try {
        const res = await callLlmWithCache({ cacheName: incomingCache, messages, max_tokens: 2048 })
        responseText = res.text
      } catch {
        const res = await callLlm({ system: systemPrompt, messages, max_tokens: 2048 })
        responseText = res.text
      }
    } else {
      const res = await callLlm({ system: systemPrompt, messages, max_tokens: 2048 })
      responseText = res.text
    }

    // 7. Tentar criar cache para próximos turnos (silencioso se < 32K tokens)
    let newCacheName: string | undefined
    if (!incomingCache && history.length === 0) {
      try {
        newCacheName = await createLlmCache({ systemInstruction: systemPrompt, ttlSeconds: 600 })
      } catch { /* abaixo do mínimo de tokens */ }
    }

    return reply.send({
      text: responseText,
      cacheName: newCacheName ?? incomingCache ?? null,
      contextCats: contextCats.map((c) => ({
        id: c.id,
        numeroCat: c.numeroCat,
        empresaContratante: c.empresaContratante,
      })),
    })
  })
}
