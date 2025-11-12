import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { z } from 'zod'

export default async function orders(app: FastifyInstance) {
  const schema = z.object({
    buyerName: z.string().min(2),
    buyerEmail: z.string().email(),
    courseSlug: z.string(),
    method: z.enum(['TRANSFER','MERCADOPAGO']).optional() // para futura rama pagos
  })

  app.post('/orders', async (req: any, reply) => {
    // opcional: si viene token, asociar userId
    let userId: string | undefined
    try { await req.jwtVerify(); userId = req.user?.sub } catch {}

    const body = schema.parse(req.body)
    const course = await prisma.course.findUnique({ where: { slug: body.courseSlug } })
    if (!course || !course.isActive) return reply.code(400).send({ message: 'Curso inexistente' })

    const order = await prisma.order.create({
      data: {
        userId,
        buyerName: body.buyerName,
        buyerEmail: body.buyerEmail,
        courseId: course.id,
        status: 'PENDING',
        source: 'SITE',
      },
      select: { id: true, status: true }
    })
    return order
  })

  // Mis compras (para /account)
  app.get('/me/orders', { preHandler: [app.authenticate] as any }, async (req: any) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.sub },
      include: { course: true, payments: true },
      orderBy: { createdAt: 'desc' }
    })
    return orders
  })

  // Admin – listado básico
  app.get('/admin/orders', { preHandler: [app.authenticate] as any }, async (req: any, reply) => {
    if (req.user.role !== 'ADMIN') return reply.code(403).send({ message: 'Forbidden' })
    const items = await prisma.order.findMany({
      include: { course: true, payments: true, user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return items
  })
}
