import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { ENV } from './env.js'
import path from 'path' // Módulo de Node.js

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

// --- PLUGINS ---

// 1. @fastify/static (Para servir archivos de /uploads)
await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'), 
    prefix: '/uploads/',
});

// 2. CORS
await app.register(cors, { 
  origin: ENV.FRONTEND_URL, 
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
})
// 3. JWT
await app.register(jwt, { secret: ENV.JWT_SECRET })

// 4. Multipart (Para manejar la subida de archivos)
// --- CORRECCIÓN: Usamos attachFieldsToBody: true, que a veces evita el conflicto,
// --- y si el problema persiste, podemos intentar registrarlo de forma segura.
await app.register(fastifyMultipart, { 
    limits: { fileSize: 5 * 1024 * 1024 },
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

await app.register(health)
await app.register(auth, { prefix: '/auth' })
await app.register(account, { prefix: '/account' })
await app.register(courses, { prefix: '/courses' })
await app.register(orders, { prefix: '/orders' })
await app.register(payments, { prefix: '/payments' })

// --- INICIO ---

app.listen({ port: ENV.PORT, host: '0.0.0.0' }).then(() => {
    app.log.info(`API on http://localhost:${ENV.PORT}`)
})