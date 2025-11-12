      
      
      import type { FastifyRequest, FastifyReply } from 'fastify'

export function requireAuth() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({ message: 'Unauthorized' })
    }
  }
}

export function requireRole(role: 'ADMIN'|'STUDENT') {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify()
      // @ts-ignore
      if (req.user.role !== role && role === 'ADMIN') return reply.code(403).send({ message: 'Forbidden' })
    } catch {
      return reply.code(401).send({ message: 'Unauthorized' })
    }
  }
}
