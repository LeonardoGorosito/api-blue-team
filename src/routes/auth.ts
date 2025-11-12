import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { prisma } from '../db.js'

// --- ESQUEMAS ZOD ---

// Esquema para el REGISTRO (debe coincidir con los datos enviados por el frontend)
const registerSchema = z.object({
  name: z.string().min(2),
  lastname: z.string().min(2),
  age: z.number().int().positive().optional(),
  telegram: z.string().optional(), // Lo hacemos opcional por si el frontend lo envía vacío
  master: z.array(z.string()), // Array de Masters
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

// Esquema para el LOGIN
const loginSchema = z.object({ 
    email: z.string().email(), 
    password: z.string().min(4) 
})


export default async function auth(app: FastifyInstance) {

    // ------------------------------------------
    // RUTA DE REGISTRO: POST /auth/register
    // ------------------------------------------
    app.post('/auth/register', async (req, reply) => {
        try {
            const body = registerSchema.parse(req.body)

            // 1. Verificar si el usuario ya existe
            const existingUser = await prisma.user.findUnique({ where: { email: body.email } })
            if (existingUser) {
                return reply.code(409).send({ message: 'El correo electrónico ya está registrado.' })
            }

            // 2. Hashear la contraseña
            // Usamos un salt de 10. La propiedad en la DB es 'passwordHash'
            const passwordHash = await bcrypt.hash(body.password, 10) 

            // 3. Crear el nuevo usuario en la base de datos
            const newUser = await prisma.user.create({
                data: {
                    name: body.name,
                    lastname: body.lastname,
                    email: body.email,
                    passwordHash: passwordHash, // Guardamos el hash
                    role: 'STUDENT', // Rol por defecto
                    // Campos adicionales:
                    age: body.age === undefined ? null : body.age,
                    telegram: body.telegram === undefined ? null : body.telegram,
                    // Manejo del array de Masters:
                    // Si tu modelo User tiene un campo 'masters' de tipo String[] o JSON, 
                    // Prisma debería manejar el array directamente si el campo es de tipo adecuado.
                    // Asumiendo que tienes un campo en el modelo que acepta un array de strings (PostgreSQL ARRAY)
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
                // Manejo de errores de validación
                return reply.code(400).send({ message: 'Datos de registro inválidos', errors: error.issues })
            }
            // Otros errores (ej: DB)
            app.log.error(error, 'Error durante el registro')
            return reply.code(500).send({ message: 'Error interno del servidor durante el registro' })
        }
    })


    // ------------------------------------------
    // RUTA DE LOGIN: POST /auth/login 
    // ------------------------------------------
    app.post('/auth/login', async (req, reply) => {
        const body = loginSchema.parse(req.body)
        const user = await prisma.user.findUnique({ where: { email: body.email } })
        
        if (!user || !user.passwordHash) return reply.code(401).send({ message: 'Credenciales inválidas' })
        
        const ok = await bcrypt.compare(body.password, user.passwordHash)
        if (!ok) return reply.code(401).send({ message: 'Credenciales inválidas' })

        const token = app.jwt.sign({ sub: user.id, role: user.role, email: user.email })
        return { token }
    })


    // ------------------------------------------
    // RUTA DE USUARIO ACTUAL: GET /auth/me (Tu código original)
    // ------------------------------------------
    app.get('/auth/me', { preHandler: [app.authenticate] as any }, async (req: any) => {
        const me = await prisma.user.findUnique({ 
            where: { id: req.user.sub }, 
            select: { id: true, email: true, name: true, role: true } 
        })
        return me
    })
}