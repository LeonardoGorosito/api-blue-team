import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import crypto from 'crypto' 
import { prisma } from '../db.js'
import { authenticate } from '../hooks/authenticate.js'
import { resend, MAIL_FROM } from '../lib/mailer.js'
// --- ESQUEMAS ZOD ---

const registerSchema = z.object({
  name: z.string().min(2),
  lastname: z.string().min(2),
  age: z.number().int().positive().optional(),
  telegram: z.string().optional(),
  master: z.array(z.string()),
  email: z.string().email(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

const loginSchema = z.object({ 
    email: z.string().email(), 
    password: z.string().min(4) 
})

// Esquema para solicitar el correo
const forgotSchema = z.object({
    email: z.string().email()
})

// Esquema para cambiar la contraseña (NUEVO)
const resetPasswordSchema = z.object({
    token: z.string(),
    newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres')
})

export default async function auth(app: FastifyInstance) {
    
    // ------------------------------------------
    // 1. RUTA DE REGISTRO
    // ------------------------------------------
    app.post('/register', async (req, reply) => { 
        try {
            const body = registerSchema.parse(req.body)

            const existingUser = await prisma.user.findUnique({ where: { email: body.email } })
            if (existingUser) {
                return reply.code(409).send({ message: 'El correo electrónico ya está registrado.' })
            }

            const passwordHash = await bcrypt.hash(body.password, 10) 

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
    // 2. RUTA DE LOGIN
    // ------------------------------------------
    app.post('/login', async (req, reply) => { 
        const body = loginSchema.parse(req.body)
        const user = await prisma.user.findUnique({ where: { email: body.email } })
        
        if (!user || !user.passwordHash) return reply.code(401).send({ message: 'Credenciales inválidas' })
        
        const ok = await bcrypt.compare(body.password, user.passwordHash)
        if (!ok) return reply.code(401).send({ message: 'Credenciales inválidas' })

        const token = app.jwt.sign({ sub: user.id, role: user.role, email: user.email })
        return { token }
    })

    // ------------------------------------------
    // 3. RUTA DE FORGOT PASSWORD (Enviar Email)
    // ------------------------------------------
    app.post('/forgot-password', async (req, reply) => {
        try {
            const body = forgotSchema.parse(req.body)
            const email = body.email

            const user = await prisma.user.findUnique({ where: { email } })

            if (!user) {
                return { message: 'Si el correo existe, recibirás las instrucciones.' }
            }

            const resetToken = crypto.randomBytes(32).toString('hex')
            const resetTokenExpiry = new Date(Date.now() + 3600000) // +1 hora

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    resetToken,
                    resetTokenExpiry
                }
            })

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
            const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`

            await resend.emails.send({
                from: MAIL_FROM,
                to: user.email,
                subject: 'Recuperación de contraseña - Blue Team',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                        <div style="background-color: #2563EB; padding: 20px; text-align: center;">
                             <h2 style="color: white; margin: 0;">Recuperación de Acceso</h2>
                        </div>
                        <div style="padding: 20px;">
                            <p>Hola <strong>${user.name}</strong>,</p>
                            <p>Hemos recibido una solicitud para restablecer la contraseña.</p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetUrl}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                    Restablecer Contraseña
                                </a>
                            </div>
                        </div>
                    </div>
                `
            })

            return { message: 'Si el correo existe, recibirás las instrucciones.' }

        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ message: 'Email inválido' })
            }
            app.log.error(error, 'Error en forgot-password')
            return reply.code(500).send({ message: 'Error al procesar la solicitud' })
        }
    })

    // ------------------------------------------
    // 4. RUTA DE RESET PASSWORD (Cambiar la clave final) <--- ESTA FALTABA
    // ------------------------------------------
    app.post('/reset-password', async (req, reply) => {
        try {
            const { token, newPassword } = resetPasswordSchema.parse(req.body)

            // Buscar usuario con ese token Y que no haya expirado
            const user = await prisma.user.findFirst({
                where: {
                    resetToken: token,
                    resetTokenExpiry: {
                        gt: new Date() // gt = greater than (mayor que ahora)
                    }
                }
            })

            if (!user) {
                return reply.code(400).send({ message: 'El enlace es inválido o ha expirado.' })
            }

            // Hashear la nueva contraseña
            const newPasswordHash = await bcrypt.hash(newPassword, 10)

            // Actualizar usuario y borrar el token usado
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash: newPasswordHash,
                    resetToken: null,
                    resetTokenExpiry: null
                }
            })

            return { message: 'Contraseña actualizada correctamente.' }

        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ message: 'Datos inválidos', errors: error.issues })
            }
            app.log.error(error, 'Error en reset-password')
            return reply.code(500).send({ message: 'Error al restablecer la contraseña' })
        }
    })
    
    // ------------------------------------------
    // 5. RUTA DE USUARIO ACTUAL
    // ------------------------------------------
    app.get('/me', { preHandler: [authenticate] }, async (req: any) => { 
        const me = await prisma.user.findUnique({ 
            where: { id: req.user.sub }, 
            select: { id: true, email: true, name: true, role: true } 
        })
        return me
    })
}