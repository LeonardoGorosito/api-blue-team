import type { FastifyInstance, RouteHandlerMethod } from 'fastify'
import { prisma } from '../db.js' // Asegúrate que la ruta a db.js sea correcta
import { authenticate } from '../hooks/authenticate.js'

export default async function adminRoutes(app: FastifyInstance) {
  
  app.get('/health', async () => ({ ok: true }))

  // 2. Endpoint CRM: Obtener alumnas y sus compras
  const getStudentsHandler: RouteHandlerMethod = async (req: any, reply) => {    
    // A. Seguridad: Verificar que sea ADMIN
    // (Asumo que req.user lo llena tu plugin de JWT/Auth)
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ message: 'Acceso denegado: Solo admins' })
    }

    try {
      // B. Consulta a la Base de Datos
      const users = await prisma.user.findMany({
        where: {
          role: 'STUDENT' // Solo traemos alumnas, no otros admins
        },
        include: {
          // Incluimos solo las órdenes PAGADAS para ver qué cursos tienen realmente
          orders: {
            where: { status: 'PAID' }, 
            include: {
              course: {
                select: { title: true, price: true, priceUsd: true }
              },
              payments: {
                select: { amount: true } // Para calcular gasto total si quisieras
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' } // Las más nuevas primero
      })

      // C. Formatear datos para el Frontend
      // Simplificamos la estructura para que la tabla sea fácil de armar
      const formattedUsers = users.map(user => {
        // Obtenemos lista de nombres de cursos
        const coursesTitles = user.orders.map(o => o.course.title)
        
        // Calculamos gasto total aproximado (opcional)
        // Sumamos los montos de los pagos realizados en las órdenes aprobadas
        const totalSpent = user.orders.reduce((acc, order) => {
             const paymentSum = order.payments.reduce((pAcc, p) => pAcc + p.amount, 0)
             return acc + paymentSum
        }, 0)

        return {
          id: user.id,
          name: user.name,
          lastname: user.lastname,
          email: user.email,
          telegram: user.telegram,
          createdAt: user.createdAt,
          purchasedCourses: coursesTitles, // Array simple: ["Master 1", "Curso 2"]
          totalSpent
        }
      })

      return formattedUsers

    } catch (error) {
      req.log.error(error)
      return reply.code(500).send({ message: 'Error obteniendo alumnas' })
    }
  }

  // D. Registrar la ruta
  // Asegúrate de que 'app.authenticate' sea el nombre correcto de tu decorador de auth
app.get('/students', { preHandler: [authenticate] }, getStudentsHandler)}    