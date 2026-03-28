import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { clerkPlugin } from '@clerk/fastify'

import { editaisRoutes } from './modules/editais/routes.js'
import { catsRoutes } from './modules/cats/routes.js'
import { crossingsRoutes } from './modules/crossings/routes.js'
import { uploadsRoutes } from './modules/uploads/routes.js'
import { dashboardRoutes } from './modules/dashboard/routes.js'
import { usersRoutes } from './modules/users/routes.js'
import { pncpCacheRoutes } from './modules/pncp-cache/routes.js'

const PORT = parseInt(process.env['API_PORT'] ?? '3001', 10)
const HOST = process.env['API_HOST'] ?? '0.0.0.0'

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
    },
  })

  // Plugins
  await app.register(cors, {
    origin: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000',
    credentials: true,
  })

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  })

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  })

  await app.register(clerkPlugin)

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Route modules
  await app.register(editaisRoutes, { prefix: '/api/editais' })
  await app.register(catsRoutes, { prefix: '/api/cats' })
  await app.register(crossingsRoutes, { prefix: '/api/crossings' })
  await app.register(uploadsRoutes, { prefix: '/api/uploads' })
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' })
  await app.register(usersRoutes, { prefix: '/api/users' })
  await app.register(pncpCacheRoutes, { prefix: '/api/pncp-cache' })

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: {
          code: 'FASTIFY_ERROR',
          message: error.message,
        },
      })
    }

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    })
  })

  return app
}

async function start() {
  const app = await buildServer()

  try {
    await app.listen({ port: PORT, host: HOST })
    console.log(`🚀 API server running at http://${HOST}:${PORT}`)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

start()
