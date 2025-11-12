import type { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'

export default async function courses(app: FastifyInstance) {
  app.get('/courses', async () => {
    const items = await prisma.course.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
    return items
  })
}
