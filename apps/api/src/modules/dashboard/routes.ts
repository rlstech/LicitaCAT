import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth.js'
import { getDashboardStats, getEditaisCostSummary } from './repository.js'

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /api/dashboard/stats
  app.get('/stats', async (request) => {
    const [stats, costs] = await Promise.all([
      getDashboardStats(request.tenantId),
      getEditaisCostSummary(request.tenantId),
    ])

    return { ...stats, costs }
  })
}
