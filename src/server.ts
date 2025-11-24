import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import fastifyMultipart from '@fastify/multipart'

import { ENV } from './env.js'

// routes
import health from './routes/health.js'
import auth from './routes/auth.js'
import courses from './routes/courses.js'
import orders from './routes/orders.js'
import payments from './routes/payments.js'
import account from './routes/account.js'

const app = Fastify({ logger: true })

// --- CORS ---
await app.register(cors, { 
  origin: [
    'https://bue-team-alumns.vercel.app',  // URL REAL (según tu captura de error)
    'https://bue-team-alumns.vercel.app', // URL alternativa (por si acaso)
    'http://localhost:5173',               // Localhost Vite
    'http://localhost:3000'                // Localhost Backend/React clásico
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
})

// --- JWT ---
await app.register(jwt, { secret: ENV.JWT_SECRET })

// --- Multipart ---
await app.register(fastifyMultipart, { 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

// --- DECORADORES ---
app.decorate('authenticate', async function (req: any, reply: any) {
  try {
    await req.jwtVerify()
  } catch (err) {
    app.log.warn({ err }, 'Fallo de autenticación')
    reply.code(401).send({ message: 'Unauthorized' })
  }
})

// --- RUTAS ---
// Ruta raíz para verificar que el servidor vive
app.get('/', async () => { return { status: 'ok', server: 'Blue Team API' } })

await app.register(health)
await app.register(auth, { prefix: '/auth' })
await app.register(account, { prefix: '/account' })
await app.register(courses, { prefix: '/courses' })
await app.register(orders, { prefix: '/orders' })
await app.register(payments, { prefix: '/payments' })

export default app