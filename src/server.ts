import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import fastifyMultipart from '@fastify/multipart'
import { ENV } from './env.js'

// Importación de rutas
import health from './routes/health.js'
import auth from './routes/auth.js'
import courses from './routes/courses.js'
import orders from './routes/orders.js'
import payments from './routes/payments.js'
import account from './routes/account.js'
import admin from './routes/admin.js' // <--- Asegúrate de tener esto

const app = Fastify({ logger: true })

// CORS

await app.register(cors, { 
  origin: [
    /localhost/,               // Permite cualquier puerto en localhost
    /^https:\/\/.*blue7eamalumnas\.com$/ // Permite blue7eamalumnas.com y www.blue7eamalumnas.com
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
})

// 2. REGISTRAR JWT
await app.register(jwt, { secret: ENV.JWT_SECRET })

// 3. REGISTRAR MULTIPART (Para subir archivos)
await app.register(fastifyMultipart, { 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

// --- NOTA: Ya NO usamos app.decorate('authenticate') aquí.
// Usamos el hook importado en cada archivo de ruta.

// 4. REGISTRAR RUTAS
app.get('/', async () => { return { status: 'ok', server: 'Blue Team API' } })

await app.register(health)
await app.register(auth, { prefix: '/auth' })
await app.register(account, { prefix: '/account' })
await app.register(courses, { prefix: '/courses' })
await app.register(orders, { prefix: '/orders' })
await app.register(payments, { prefix: '/payments' })
await app.register(admin, { prefix: '/admin' }) // <--- La nueva ruta

export default app