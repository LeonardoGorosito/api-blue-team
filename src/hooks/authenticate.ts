import { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch (err) {
    req.log.warn('Fallo de autenticación')
    return reply.code(401).send({ message: 'No autorizado' })
  }
}