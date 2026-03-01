import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { NotFoundError, ValidationError } from '@licitacat/shared/errors'
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
  listCatItens,
  createCatItem,
  updateCatItem,
  deleteCatItem,
} from './repository.js'

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
}
