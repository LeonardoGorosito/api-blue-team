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

// 1. @fastify/static
await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'), 
    prefix: '/uploads/',
});

// 2. CORS (Configuración "Hardcodeada" - A PRUEBA DE ERRORES)
await app.register(cors, { 
  origin: (origin, callback) => {
    
    // --- ESTA ES LA LÍSTA MÁS IMPORTANTE ---
    // Escribimos tu URL de frontend directamente.
    const allowedOrigins = [
      'https://bue-team-alumns.vercel.app',  // <-- ¡TU FRONTEND DE PRODUCCIÓN!
      'http://localhost:5173',              // Tu frontend en Local (Vite)
      'http://localhost:3000'
    ];

    // Permitir si el 'origin' está en la lista O si es 'undefined' (Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true) // Permitir
    } else {
      callback(new Error('No permitido por CORS'), false) // Bloquear
    }
  },
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] // ¡OPTIONS es clave!
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