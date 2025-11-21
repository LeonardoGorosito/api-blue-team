import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { ENV } from './env.js'
import path from 'path' // Módulo de Node.js
import fs from 'fs'


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

const uploadsPath = path.join(process.cwd(), 'uploads')

if (fs.existsSync(uploadsPath)) {
  await app.register(fastifyStatic, {
    root: uploadsPath,
    prefix: '/uploads/',
  })
} else {
  app.log.warn(`Uploads dir ${uploadsPath} does not exist, skipping static plugin`)
}

// 1. @fastify/static
await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'), 
    prefix: '/uploads/',
});


// 2. CORS (Configuración "Hardcodeada" - A PRUEBA DE ERRORES)
await app.register(cors, { 
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
})


// 3. JWT
await app.register(jwt, { secret: ENV.JWT_SECRET })

// 4. Multipart
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

// Código para arrancar en local (npm run dev)
if (process.env.NODE_ENV !== 'production') {
  const start = async () => {
    try {
      const port = Number(ENV.PORT) || 3000;
      await app.listen({ port: port, host: '0.0.0.0' });
      app.log.info(`Servidor HTTP corriendo en http://localhost:${port}`);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  start();
}

export default app