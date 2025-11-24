import type { FastifyInstance, RouteHandlerMethod } from 'fastify'
import { prisma } from '../db.js' // Asegúrate que la ruta a tu prisma client sea correcta
import { z } from 'zod'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

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

      // Intentamos obtener el usuario si está logueado, sino sigue como invitado
      try {
        await req.jwtVerify()
        userId = req.user.sub
      } catch {}

      const body = createOrderSchema.parse(req.body)

      const course = await prisma.course.findUnique({ where: { slug: body.courseSlug } })
      
      if (!course || !course.isActive) {
        return reply.code(400).send({ message: 'Curso inexistente o inactivo' })
      }

      // Creamos la orden (Aún sin pago asociado)
      const order = await prisma.order.create({
        data: {
          userId,
          buyerName: body.buyerName,
          buyerEmail: body.buyerEmail,
          courseId: course.id,
          status: 'PENDING',
          source: 'SITE',
          // Guardamos el método en notas para leerlo luego al subir el comprobante
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

  // Asegúrate de tener el decorador 'authenticate' configurado en tu app
  app.get('/me', { preHandler: [app.authenticate] }, getMyOrdersHandler)

  // ----------------------------
  // 3. SUBIR COMPROBANTE (POST /orders/:id/receipt)
  // ----------------------------
  const uploadReceiptHandler: RouteHandlerMethod = async (req: any, reply) => {
    const { id } = req.params

    // A. Obtener el archivo
    const data = await req.file()
    if (!data) {
      return reply.code(400).send({ message: 'No se envió ningún archivo' })
    }

    // B. Convertir Stream a Base64
    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)
    const base64 = buffer.toString('base64')
    // Usamos el mimetype original para soportar PDF, PNG, JPG, etc.
    const dataUri = `data:${data.mimetype};base64,${base64}`

    // C. Subir a Cloudinary
    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'tuwebconleo/comprobantes'

    let uploadResult
    try {
      uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder,
        public_id: `receipt_${id}_${Date.now()}`,
        resource_type: 'auto' // 'auto' permite subir PDFs e Imágenes
      })
    } catch (err) {
      app.log.error(err)
      return reply.code(500).send({ message: 'Error subiendo comprobante a Cloudinary' })
    }

    // D. Buscar la Orden y el Curso
    const order = await prisma.order.findUnique({
      where: { id },
      include: { course: true, payments: true }
    })

    if (!order) return reply.code(404).send({ message: 'Orden no encontrada' })

    // E. Lógica de Moneda (ARS vs USD)
    let methodDetected = 'TRANSFER' // Valor por defecto
    let finalAmount = order.course.price // Valor por defecto (ARS)
    let finalCurrency = order.course.currency // Valor por defecto (ARS)

    // Leemos la nota que guardamos al crear la orden: "Método seleccionado: USDT"
    const noteMethod = order.notes?.split(': ')[1]?.trim()
    
    // Métodos que cobran en Dólares
    const usdMethods = ['USDT', 'SKRILL', 'AIRTM', 'PREX', 'TIPFUNDER']

    if (noteMethod && usdMethods.includes(noteMethod)) {
       methodDetected = noteMethod
       finalAmount = order.course.priceUsd // Cobramos el precio en USD
       finalCurrency = 'USD'
    } else if (noteMethod) {
       methodDetected = noteMethod
       // finalAmount queda en ARS
    }

    // F. Crear o Actualizar Pago
    // Verificamos si ya existe un pago en revisión para no duplicar
    const pendingPayment = order.payments.find(p => p.status === 'PENDING_REVIEW')

    if (pendingPayment) {
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          receiptUrl: uploadResult.secure_url,
          updatedAt: new Date(),
          amount: finalAmount, // Actualizamos por si el precio cambió
          currency: finalCurrency
        }
      })
    } else {
      await prisma.payment.create({
        data: {
          orderId: id,
          method: methodDetected as any, // Cast a 'any' para evitar conflictos estrictos con el Enum si TS se queja
          amount: finalAmount,
          currency: finalCurrency,
          status: 'PENDING_REVIEW',
          receiptUrl: uploadResult.secure_url
        }
      })
    }

    return { 
      message: 'Comprobante subido exitosamente', 
      url: uploadResult.secure_url 
    }
  }

  app.post('/:id/receipt', uploadReceiptHandler)

  // ----------------------------
  // 4. LISTADO ADMIN (GET /orders/admin)
  // ----------------------------
  const getAdminOrdersHandler: RouteHandlerMethod = async (req: any, reply) => {
    // Verificación de rol
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ message: 'Acceso denegado' })
    }

    const items = await prisma.order.findMany({
      include: { 
        course: true,
        payments: true,
        user: { select: { email: true, name: true, lastname: true } }
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
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ message: 'Acceso denegado' })
    }

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