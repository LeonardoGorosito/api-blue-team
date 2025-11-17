import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'

export default async function account(app: FastifyInstance) {

  // Esta ruta se convertirá en GET /account/stats
  // gracias al prefijo que pondremos en server.ts
  app.get('/stats', {
    // ¡IMPORTANTE! Protegemos la ruta.
    // Solo un usuario autenticado puede ver sus propias estadísticas.
    preHandler: [app.authenticate] as any
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