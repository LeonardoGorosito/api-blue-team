import '@fastify/jwt'
import { FastifyInstance } from 'fastify'

// 1. Extender FastifyInstance para incluir 'jwt' y 'authenticate'
declare module 'fastify' {
  interface FastifyInstance {
    // fastify-jwt añade la propiedad 'jwt' a la instancia de Fastify
    jwt: {
      sign: (payload: any, options?: any) => string
    }
    // fastify-jwt añade el método 'authenticate' para preHandler
    authenticate: (request: any, reply: any) => Promise<void>
  }

  // Opcional: Extender FastifyRequest para incluir 'user' si lo usas en el preHandler
  interface FastifyRequest {
    user: {
      sub: string
      role: string
      email: string
      // Puedes añadir otras propiedades del payload de tu token aquí
    }
  }
}