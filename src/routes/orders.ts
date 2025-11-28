// src/routes/orders.ts
import type { FastifyInstance, RouteHandlerMethod } from 'fastify'
import { prisma } from '../db.js'
import { z } from 'zod'
import { v2 as cloudinary } from 'cloudinary'
import { authenticate } from '../hooks/authenticate.js'
// BORRA EL IMPORT DE NODEMAILER AQUÍ

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// BORRA LA CONFIGURACIÓN DEL TRANSPORTER AQUÍ

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

  // 1. CREAR ORDEN
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

  // 2. MIS COMPRAS
  const getMyOrdersHandler: RouteHandlerMethod = async (req: any) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.sub },
      include: { course: true, payments: true },
      orderBy: { createdAt: 'desc' }
    })
    return orders
  }
  app.get('/me', { preHandler: [authenticate] }, getMyOrdersHandler)

  // 3. SUBIR COMPROBANTE (SIN EMAIL)
  const uploadReceiptHandler: RouteHandlerMethod = async (req: any, reply) => {
    const { id } = req.params
    const data = await req.file()
    if (!data) return reply.code(400).send({ message: 'No se envió ningún archivo' })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)
    const base64 = buffer.toString('base64')
    const dataUri = `data:${data.mimetype};base64,${base64}`

    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'tuwebconleo/comprobantes'

    let uploadResult
    try {
      uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder,
        public_id: `receipt_${id}_${Date.now()}`,
        resource_type: 'auto'
      })
    } catch (err) {
      app.log.error(err)
      return reply.code(500).send({ message: 'Error subiendo comprobante a Cloudinary' })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { course: true, payments: true }
    })

    if (!order) return reply.code(404).send({ message: 'Orden no encontrada' })

    let methodDetected = 'TRANSFER'
    let finalAmount = order.course.price
    let finalCurrency = order.course.currency
    const noteMethod = order.notes?.split(': ')[1]?.trim()
    const usdMethods = ['USDT', 'SKRILL', 'AIRTM', 'PREX', 'TIPFUNDER']

    if (noteMethod && usdMethods.includes(noteMethod)) {
       methodDetected = noteMethod
       finalAmount = order.course.priceUsd
       finalCurrency = 'USD'
    } else if (noteMethod) {
       methodDetected = noteMethod
    }

    const pendingPayment = order.payments.find(p => p.status === 'PENDING_REVIEW')

    if (pendingPayment) {
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          receiptUrl: uploadResult.secure_url,
          updatedAt: new Date(),
          amount: finalAmount,
          currency: finalCurrency
        }
      })
    } else {
      await prisma.payment.create({
        data: {
          orderId: id,
          method: methodDetected as any,
          amount: finalAmount,
          currency: finalCurrency,
          status: 'PENDING_REVIEW',
          receiptUrl: uploadResult.secure_url
        }
      })
    }

    // AQUI BORRAMOS TODO EL BLOQUE DEL TRANSPORTER.SENDMAIL

    return { 
      message: 'Comprobante subido exitosamente', 
      url: uploadResult.secure_url 
    }
  }

  app.post('/:id/receipt', uploadReceiptHandler)

  // ... (El resto de admin sigue igual)
  const getAdminOrdersHandler: RouteHandlerMethod = async (req: any, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') return reply.code(403).send({ message: 'Acceso denegado' })
    const items = await prisma.order.findMany({
      include: { course: true, payments: true, user: { select: { email: true, name: true, lastname: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return items
  }
  app.get('/admin', { preHandler: [authenticate] }, getAdminOrdersHandler)

  const updateStatusHandler: RouteHandlerMethod = async (req: any, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') return reply.code(403).send({ message: 'Acceso denegado' })
    const { id } = req.params
    const { status } = updateStatusSchema.parse(req.body)
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: { user: true, course: true }
    })
    return updatedOrder
  }
  app.put('/:id/status', { preHandler: [authenticate] }, updateStatusHandler)
}