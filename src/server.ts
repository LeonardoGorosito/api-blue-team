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

// 2. CORS (Configuración Robusta Corregida)
// Esta es la versión que corrige el error 405
await app.register(cors, { 
  origin: (origin, callback) => {
    // 'origin' es la URL del navegador (ej: http://localhost:5173)
    // ENV.FRONTEND_URL es la variable de Vercel (ej: https://bue-team-alumns.vercel.app)
    
    const allowedOrigins = [
            'https://bue-team-alumns.vercel.app',
            'https://bue-team-alumns-m8dgqtcgg-portafolioleog.vercel.app', 
            'http://localhost:5173',
            'http://localhost:3000'
        ]


    // Permitir si el 'origin' está en la lista O si es 'undefined' (ej. Postman, apps móviles)
    if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true) // Permitir
        } else {
          callback(new Error('No permitido por CORS'), false) // Bloquear
        }
      },
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] // Asegúrate que OPTIONS esté
})

// 3. JWT
await app.register(jwt, { secret: ENV.JWT_SECRET })

// 4. Multipart (Para manejar la subida de archivos)
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

export default app