import type { FastifyInstance, RouteHandlerMethod } from 'fastify'
import { prisma } from '../db.js'
import { authenticate } from '../hooks/authenticate.js'

export default async function adminRoutes(app: FastifyInstance) {
  
  // 1. CRM DE ALUMNAS
  const getStudentsHandler: RouteHandlerMethod = async (req: any, reply) => {    
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ message: 'Acceso denegado' })
    }

    try {
      const users = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        include: {
          orders: {
            where: { status: 'PAID' }, 
            include: {
              course: { select: { title: true } },
              payments: { select: { amount: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return users.map(user => ({
        id: user.id,
        name: user.name,
        lastname: user.lastname,
        email: user.email,
        telegram: user.telegram,
        createdAt: user.createdAt,
        purchasedCourses: user.orders.map(o => o.course.title),
        totalSpent: user.orders.reduce((acc, order) => 
          acc + order.payments.reduce((pAcc, p) => pAcc + p.amount, 0), 0
        )
      }))
    } catch (error) {
      return reply.code(500).send({ message: 'Error obteniendo alumnas' })
    }
  }

  // 2. CRM DE INGRESOS (REVENUE)
  const getRevenueHandler: RouteHandlerMethod = async (req: any, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ message: 'Acceso denegado' })
    }

    try {
      const orders = await prisma.order.findMany({
        where: { status: 'PAID' },
        include: {
          user: true,
          course: true,
          payments: true
        },
        orderBy: { createdAt: 'desc' }
      })

      return orders.map(order => {
        const payment = order.payments[0]
        return {
          id: order.id,
          createdAt: order.createdAt,
          // Manejo de usuario nulo: usamos buyerName de la orden como fallback
          studentName: order.user ? `${order.user.name} ${order.user.lastname}` : order.buyerName,
          studentEmail: order.user?.email || order.buyerEmail,
          courseTitle: order.course.title,
          // Si no hay registro de pago, usamos el precio del curso
          amount: payment?.amount || order.course.price,
          // Si el pago no tiene moneda (común en transferencias), usamos la del curso
          currency: payment?.currency || order.course.currency || 'ARS'
        }
      })
    } catch (error) {
      return reply.code(500).send({ message: 'Error obteniendo ingresos' })
    }
  }

  // Registro de rutas
  app.get('/students', { preHandler: [authenticate] }, getStudentsHandler)
  app.get('/revenue', { preHandler: [authenticate] }, getRevenueHandler)
}