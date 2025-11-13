import type { FastifyInstance, FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify'
import { prisma } from '../db.js'
import { z } from 'zod'
import { pipeline } from 'stream'
import util from 'util'
import fs from 'fs'
import path from 'path'

// Utilidad para guardar archivos (stream) de forma segura
const pump = util.promisify(pipeline)

export default async function orders(app: FastifyInstance) {

    // --- SCHEMAS DE VALIDACIÓN ---
    
    const createOrderSchema = z.object({
        buyerName: z.string().min(2),
        buyerEmail: z.string().email(),
        courseSlug: z.string(),
        method: z.string().optional()
    })

    const updateStatusSchema = z.object({
        status: z.enum(['PAID', 'REJECTED', 'CANCELLED', 'PENDING']),
    })

    // --- RUTAS ---

    // 1. CREAR ORDEN (POST /orders/)
    const createOrderHandler: RouteHandlerMethod = async (req, reply) => {
        let userId: string | undefined
        try { 
            // req.jwtVerify() y req.user son accedidos directamente y tipados (gracias a fastify.d.ts)
            // @ts-ignore - req.jwtVerify no está oficialmente en el tipo FastifyRequest, pero es inyectado.
            await req.jwtVerify(); 
            // @ts-ignore - req.user está inyectado por jwtVerify.
            userId = req.user.sub 
        } catch {}

        const body = createOrderSchema.parse(req.body)

        // Buscamos el curso
        const course = await prisma.course.findUnique({ where: { slug: body.courseSlug } })
        
        if (!course || !course.isActive) {
            return reply.code(400).send({ message: 'Curso inexistente o inactivo' })
        }

        // Creamos la orden
        const order = await prisma.order.create({
            data: {
                userId: userId || null,
                buyerName: body.buyerName,
                buyerEmail: body.buyerEmail,
                courseId: course.id,
                status: 'PENDING',
                source: 'SITE',
                notes: body.method ? `Método seleccionado: ${body.method}` : null
            },
            select: { id: true, status: true }
        })

        return order
    }
    app.post('/', createOrderHandler)

    // 2. MIS COMPRAS (GET /orders/me)
    const getMyOrdersHandler: RouteHandlerMethod = async (req, reply) => {
        // req.user está tipado correctamente
        const orders = await prisma.order.findMany({
            // @ts-ignore - req.user está disponible gracias al preHandler y fastify.d.ts
            where: { userId: req.user.sub },
            include: { 
                course: true, 
                payments: true 
            },
            orderBy: { createdAt: 'desc' }
        })
        return orders
    }
    app.get('/me', { preHandler: [app.authenticate] }, getMyOrdersHandler)

    // 3. SUBIR COMPROBANTE (POST /orders/:id/receipt)
    const uploadReceiptHandler: RouteHandlerMethod = async (req, reply) => {
        // @ts-ignore: Accedemos a params que no están tipados con zod
        const { id } = req.params
        
        // req.file() está tipado correctamente
        const data = await req.file() 
        if (!data) return reply.code(400).send({ message: 'No se envió ningún archivo' })

        // Crea la carpeta 'uploads' si no existe
        const uploadDir = path.join(process.cwd(), 'uploads')
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir)
        }

        // Generamos un nombre único
        const fileName = `${id}-${Date.now()}-${data.filename}`
        const uploadPath = path.join(uploadDir, fileName)
        
        // Guardamos el archivo
        await pump(data.file, fs.createWriteStream(uploadPath))

        // Buscamos la orden
        const order = await prisma.order.findUnique({ 
            where: { id },
            include: { course: true } 
        })
        
        if (!order) return reply.code(404).send({ message: 'Orden no encontrada' })

        // Creamos el registro del PAGO
        await prisma.payment.create({
            data: {
                orderId: id,
                method: 'TRANSFER',
                amount: order.course.price,
                currency: order.course.currency,
                status: 'PENDING_REVIEW',
                receiptUrl: `/uploads/${fileName}` 
            }
        })

        return { message: 'Comprobante subido exitosamente' }
    }
    app.post('/:id/receipt', uploadReceiptHandler)

    // 4. LISTADO ADMIN (GET /orders/admin)
    const getAdminOrdersHandler: RouteHandlerMethod = async (req, reply) => {
        // @ts-ignore - req.user está disponible gracias al preHandler y fastify.d.ts
        if (req.user.role !== 'ADMIN') return reply.code(403).send({ message: 'Acceso denegado' })

        const items = await prisma.order.findMany({
            include: { 
                course: true, 
                payments: true, 
                user: { select: { email: true } } 
            },
            orderBy: { createdAt: 'desc' }
        })
        return items
    }
    app.get('/admin', { preHandler: [app.authenticate] }, getAdminOrdersHandler)

    // 5. CAMBIAR ESTADO ADMIN (PUT /orders/:id/status)
    const updateStatusHandler: RouteHandlerMethod = async (req, reply) => {
        // @ts-ignore - req.user está disponible gracias al preHandler y fastify.d.ts
        if (req.user.role !== 'ADMIN') return reply.code(403).send({ message: 'Acceso denegado' })

        // @ts-ignore: Accedemos a params
        const { id } = req.params
        const { status } = updateStatusSchema.parse(req.body)

        const updatedOrder = await prisma.order.update({
            where: { id },
            data: { status },
            include: { user: true, course: true }
        })
        
        return updatedOrder
    }
    app.put('/:id/status', { preHandler: [app.authenticate] }, updateStatusHandler)

    // 6. Servir archivos estáticos (Comprobantes)
    const serveUploadsHandler: RouteHandlerMethod = async (req, reply) => {
        // @ts-ignore - req.user está disponible gracias al preHandler y fastify.d.ts
        if (req.user.role !== 'ADMIN') return reply.code(403).send({ message: 'Acceso denegado' })
        
        // @ts-ignore: Accedemos a params
        const { filename } = req.params
        
        // reply.sendFile ahora está tipado correctamente
        // @ts-ignore - reply.sendFile está en la Aumentación de Módulos
        return reply.sendFile(filename)
    }
    app.get('/uploads/:filename', { preHandler: [app.authenticate] }, serveUploadsHandler)
}