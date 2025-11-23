// src/routes/orders.ts
import type { FastifyInstance, RouteHandlerMethod } from 'fastify'
import { prisma } from '../db.js'
import { z } from 'zod'
import cloudinary from '../cloudinary.js'

// ----------------------------
// ZOD SCHEMAS
// ----------------------------
const createOrderSchema = z.object({
  buyerName: z.string().min(2),
  buyerEmail: z.string().email(),
  courseSlug: z.string(),
  method: z.string().optional()
})

const updateStatusSchema = z.object({
  status: z.enum(['PAID', 'REJECTED', 'CANCELLED', 'PENDING']),
})

export default async function orders(app: FastifyInstance) {

  // ----------------------------
  // 1. CREAR ORDEN (POST /orders/)
  // ----------------------------
  const createOrderHandler: RouteHandlerMethod = async (req: any, reply) => {

    try {
      let userId: string | null = null

      try {
        await req.jwtVerify()
        userId = req.user.sub
      } catch {}

      const body = createOrderSchema.parse(req.body)

      const course = await prisma.course.findUnique({ where: { slug: body.courseSlug } })
      if (!course || !course.isActive) {
        return reply.code(400).send({ message: 'Curso inexistente o inactivo' })
      }

      const order = await prisma.order.create({
        data: {
          userId,
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

    } catch (err: any) {
      app.log.error(err)
      return reply.code(400).send({ message: err.message || 'Error al crear orden' })
    }
  }

  app.post('/', createOrderHandler)

  // ----------------------------
  // 2. MIS COMPRAS (GET /orders/me)
  // ----------------------------
  const getMyOrdersHandler: RouteHandlerMethod = async (req: any) => {
    const orders = await prisma.order.findMany({
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

  // ----------------------------
  // 3. SUBIR COMPROBANTE (POST /orders/:id/receipt)
  // ----------------------------
  const uploadReceiptHandler: RouteHandlerMethod = async (req: any, reply) => {

    const { id } = req.params
    const data = await req.file()

    if (!data) {
      return reply.code(400).send({ message: 'No se envió ningún archivo' })
    }

    // ----------------------------
    // Convertimos el archivo a base64
    // ----------------------------
    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)
    const base64 = buffer.toString('base64')
    const dataUri = `data:${data.mimetype};base64,${base64}`

    // ----------------------------
    // Cargamos en Cloudinary
    // ----------------------------
    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'blue-team-comprobantes'

    let uploadResult
    try {
      uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder,
        resource_type: 'image'
      })
    } catch (err) {
      app.log.error(err)
      return reply.code(500).send({ message: 'Error subiendo comprobante a Cloudinary' })
    }

    // ----------------------------
    // Guardamos en DB
    // ----------------------------
    const order = await prisma.order.findUnique({
      where: { id },
      include: { course: true }
    })

    if (!order) return reply.code(404).send({ message: 'Orden no encontrada' })

    await prisma.payment.create({
      data: {
        orderId: id,
        method: 'TRANSFER',
        amount: order.course.price,
        currency: order.course.currency,
        status: 'PENDING_REVIEW',
        receiptUrl: uploadResult.secure_url
      }
    })

    return { message: 'Comprobante subido exitosamente', url: uploadResult.secure_url }
  }

  app.post('/:id/receipt', uploadReceiptHandler)

  // ----------------------------
  // 4. LISTADO ADMIN (GET /orders/admin)
  // ----------------------------
  const getAdminOrdersHandler: RouteHandlerMethod = async (req: any, reply) => {
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

  // ----------------------------
  // 5. CAMBIAR ESTADO ADMIN (PUT /orders/:id/status)
  // ----------------------------
  const updateStatusHandler: RouteHandlerMethod = async (req: any, reply) => {
    if (req.user.role !== 'ADMIN') return reply.code(403).send({ message: 'Acceso denegado' })

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
}
