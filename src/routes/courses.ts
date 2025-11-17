// En src/routes/courses.ts (en tu API)
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'

export default async function courses(app: FastifyInstance) {
  
  // GET /courses -> Devuelve todos los cursos
  app.get('/', async (req, reply) => {
    const courses = await prisma.course.findMany({
      where: { isActive: true } 
    })
    return courses
  })
}

