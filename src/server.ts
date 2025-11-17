import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { ENV } from './env.js'
import path from 'path'

// plugins
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'

// routes
import health from './routes/health.js'
import auth from './routes/auth.js'
import courses from './routes/courses.js'
import orders from './routes/orders.js'
import payments from './routes/payments.js'
import account from './routes/account.js'

const app = Fastify({ logger: true })

// --- STATIC FILES ---
await app.register(fastifyStatic, {
  root: path.join(process.cwd(), 'uploads'),
  prefix: '/uploads/',
})

// --- CORS (modo abierto para debug) ---
await app.register(cors, {
  origin: true, // 🔥 acepta cualquier origin y lo refleja en Access-Control-Allow-Origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// --- JWT ---
await app.register(jwt, { secret: ENV.JWT_SECRET })

// --- MULTIPART ---
await app.register(fastifyMultipart, {
  limits: { fileSize: 5 * 1024 * 1024 },
})

// --- DECORADORES ---
app.decorate('authenticate', async function (req: any, reply: any) {
  try {
    await req.jwtVerify()
  } catch (err) {
    req.log.warn({ err }, 'Fallo de autenticación')
    reply.code(401).send({ message: 'Unauthorized' })
  }
})

// --- RUTAS ---
await app.register(health)
await app.register(auth, { prefix: '/auth' })
await app.register(account, { prefix: '/account' })
await app.register(courses, { prefix: '/courses' })
await app.register(orders, { prefix: '/orders' })
await app.register(payments, { prefix: '/payments' })

// --- EXPORT ---
export default app
