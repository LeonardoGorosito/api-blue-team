import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { authenticate } from '../hooks/authenticate.js'

export default async function account(app: FastifyInstance) {

  app.get('/stats', {
    // 2. CAMBIAR ESTO:
    preHandler: [authenticate] // (Antes era [app.authenticate])
  }, async (req: any, reply) => {
    
    try {
      // 1. Obtenemos el ID del usuario del token JWT
      // (Esto lo añade el decorador 'authenticate')
      const userId = req.user.sub

      // 2. Hacemos las 3 consultas a la DB en paralelo para máxima eficiencia
      
      // Contamos el total de órdenes (compras) de este usuario
      const totalPurchasesPromise = prisma.order.count({
        where: { userId: userId }
      })

      // Contamos las órdenes pendientes
      const pendingPromise = prisma.order.count({
        where: {
          userId: userId,
          status: 'PENDING' 
        }
      })
      
      // Contamos los cursos activos (órdenes completadas/pagadas)
      // ---
      // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
      // ---
      // El estado 'COMPLETED' no existe, el estado correcto es 'PAID'
      const activeCoursesPromise = prisma.order.count({
        where: {
          userId: userId,
          status: 'PAID' // <-- CORREGIDO (antes 'COMPLETED')
        }
      })

      // 3. Esperamos a que todas las consultas terminen
      const [totalPurchases, pending, activeCourses] = await Promise.all([
        totalPurchasesPromise,
        pendingPromise,
        activeCoursesPromise
      ])

      // 4. Devolvemos el JSON exacto que el frontend espera
      return { totalPurchases, pending, activeCourses }

    } catch (error) {
      app.log.error(error, `Error al obtener estadísticas para el usuario ${req.user.sub}`)
      return reply.code(500).send({ message: 'Error interno al cargar estadísticas' })
    }
  })

  // Aquí puedes añadir más rutas en el futuro, como:
  // app.get('/my-orders', ...)
  // app.patch('/profile', ...)
}