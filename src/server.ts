import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { ENV } from './env.js'

// routes
import health from './routes/health.js'
import auth from './routes/auth.js'
import courses from './routes/courses.js'
import orders from './routes/orders.js'
import payments from './routes/payments.js'

const app = Fastify({ logger: true })

// CORS
await app.register(cors, { origin: ENV.FRONTEND_URL, credentials: false })

// JWT
await app.register(jwt, { secret: ENV.JWT_SECRET })
// helper para auth middleware
app.decorate('authenticate', async function (req: any, reply: any) {
  try { await req.jwtVerify() } catch { reply.code(401).send({ message: 'Unauthorized' }) }
})

// Rutas
await app.register(health)
await app.register(auth)
await app.register(courses)
await app.register(orders)
await app.register(payments)

app.listen({ port: ENV.PORT, host: '0.0.0.0' }).then(() => {
  app.log.info(`API on http://localhost:${ENV.PORT}`)
})
