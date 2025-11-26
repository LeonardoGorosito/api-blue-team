import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { prisma } from '../db.js'
import { authenticate } from '../hooks/authenticate.js'

// --- ESQUEMAS ZOD ---
// (Los esquemas no cambian, los incluyo para que el archivo esté completo)

// Esquema para el REGISTRO
const registerSchema = z.object({
  name: z.string().min(2),
  lastname: z.string().min(2),
  age: z.number().int().positive().optional(),
  telegram: z.string().optional(),
  master: z.array(z.string()),
  email: z.string().email(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

// Esquema para el LOGIN
const loginSchema = z.object({ 
    email: z.string().email(), 
    password: z.string().min(4) 
})


// El 'app' aquí es un 'namespace' encapsulado.
// Fastify manejará el prefijo '/auth' automáticamente.
export default async function auth(app: FastifyInstance) {
    // ------------------------------------------
    // RUTA DE REGISTRO: POST /register
    // (Se convierte en POST /auth/register gracias al prefijo en server.ts)
    // ------------------------------------------
    app.post('/register', async (req, reply) => { // CAMBIO: Se quitó '/auth'
        try {
            const body = registerSchema.parse(req.body)

            // 1. Verificar si el usuario ya existe
            const existingUser = await prisma.user.findUnique({ where: { email: body.email } })
            if (existingUser) {
                return reply.code(409).send({ message: 'El correo electrónico ya está registrado.' })
            }

            // 2. Hashear la contraseña
            const passwordHash = await bcrypt.hash(body.password, 10) 

            // 3. Crear el nuevo usuario en la base de datos
            const newUser = await prisma.user.create({
                data: {
                    name: body.name,
                    lastname: body.lastname,
                    email: body.email,
                    passwordHash: passwordHash,
                    role: 'STUDENT', 
                    age: body.age === undefined ? null : body.age,
                    telegram: body.telegram === undefined ? null : body.telegram,
                    masters: body.master,
                },
                select: { id: true, email: true, role: true, name: true }
            })

            // 4. Generar y devolver el token JWT
            const token = app.jwt.sign({ 
                sub: newUser.id, 
                role: newUser.role, 
                email: newUser.email 
            })
            
            return { token }

        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ message: 'Datos de registro inválidos', errors: error.issues })
            }
            app.log.error(error, 'Error durante el registro')
            return reply.code(500).send({ message: 'Error interno del servidor durante el registro' })
        }
    })


    // ------------------------------------------
    // RUTA DE LOGIN: POST /login
    // (Se convierte en POST /auth/login)
    // ------------------------------------------
    app.post('/login', async (req, reply) => { // CAMBIO: Se quitó '/auth'
        const body = loginSchema.parse(req.body)
        const user = await prisma.user.findUnique({ where: { email: body.email } })
        
        if (!user || !user.passwordHash) return reply.code(401).send({ message: 'Credenciales inválidas' })
        
        const ok = await bcrypt.compare(body.password, user.passwordHash)
        if (!ok) return reply.code(401).send({ message: 'Credenciales inválidas' })

        const token = app.jwt.sign({ sub: user.id, role: user.role, email: user.email })
        return { token }
    })

    
    // ------------------------------------------
    // RUTA DE USUARIO ACTUAL: GET /me
    // (Se convierte en GET /auth/me)
    // ------------------------------------------
    app.get('/me', { preHandler: [authenticate] }, async (req: any) => { 
        const me = await prisma.user.findUnique({ 
            where: { id: req.user.sub }, 
            select: { id: true, email: true, name: true, role: true } 
        })
        return me
    })
}