import type { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { NotFoundError, ValidationError, ForbiddenError } from '@licitacat/shared/errors'
import { InviteUserSchema, UpdateUserSchema, UserParamsSchema } from './schema.js'
import {
  listUsers,
  findUserById,
  findUserByEmail,
  createInvitedUser,
  updateUser,
  deleteUser,
} from './repository.js'

export async function usersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /api/users/me — current user profile (any role)
  app.get('/me', async (request) => {
    const user = await findUserById(request.tenantId, request.userId)
    if (!user) throw new NotFoundError('User not found')
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
    }
  })

  // GET /api/users — list all users in tenant (admin only)
  app.get(
    '/',
    { preHandler: requireRole('admin') },
    async (request) => {
      return listUsers(request.tenantId)
    },
  )

  // POST /api/users — invite user by email (admin only)
  app.post(
    '/',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const body = InviteUserSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())

      const existing = await findUserByEmail(request.tenantId, body.data.email)
      if (existing) {
        throw new ValidationError('Email already exists in this tenant', {
          fieldErrors: { email: ['Esse e-mail já está cadastrado nesta empresa.'] },
          formErrors: [],
        })
      }

      const user = await createInvitedUser(request.tenantId, body.data)
      return reply.status(201).send(user)
    },
  )

  // PATCH /api/users/:id — update role or active status (admin only)
  app.patch(
    '/:id',
    { preHandler: requireRole('admin') },
    async (request) => {
      const params = UserParamsSchema.safeParse(request.params)
      if (!params.success) throw new ValidationError('Invalid params', params.error.flatten())

      const body = UpdateUserSchema.safeParse(request.body)
      if (!body.success) throw new ValidationError('Invalid body', body.error.flatten())

      // Prevent admin from demoting/deactivating themselves
      if (params.data.id === request.userId) {
        throw new ForbiddenError('Você não pode alterar seu próprio usuário.')
      }

      const target = await findUserById(request.tenantId, params.data.id)
      if (!target) throw new NotFoundError('User not found')

      return updateUser(request.tenantId, params.data.id, body.data)
    },
  )

  // DELETE /api/users/:id — deactivate user (admin only, soft delete)
  app.delete(
    '/:id',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const params = UserParamsSchema.safeParse(request.params)
      if (!params.success) throw new ValidationError('Invalid params', params.error.flatten())

      if (params.data.id === request.userId) {
        throw new ForbiddenError('Você não pode desativar seu próprio usuário.')
      }

      const target = await findUserById(request.tenantId, params.data.id)
      if (!target) throw new NotFoundError('User not found')

      await updateUser(request.tenantId, params.data.id, { active: false })
      return reply.status(204).send()
    },
  )

  // DELETE /api/users/:id/permanent — hard delete (admin only)
  app.delete(
    '/:id/permanent',
    { preHandler: requireRole('admin') },
    async (request, reply) => {
      const params = UserParamsSchema.safeParse(request.params)
      if (!params.success) throw new ValidationError('Invalid params', params.error.flatten())

      if (params.data.id === request.userId) {
        throw new ForbiddenError('Você não pode excluir seu próprio usuário.')
      }

      const target = await findUserById(request.tenantId, params.data.id)
      if (!target) throw new NotFoundError('User not found')

      await deleteUser(request.tenantId, params.data.id)
      return reply.status(204).send()
    },
  )
}
