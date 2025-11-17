import 'fastify';
import '@fastify/jwt'; // Importar esto para los tipos de JWT

// Aquí le decimos a TypeScript que vamos a modificar (aumentar) el módulo 'fastify'
declare module 'fastify' {
  
  // 1. Aumentamos la FastifyInstance (el objeto 'app')
  export interface FastifyInstance {
    // Le decimos que 'authenticate' existe y es una función
    // que coincide con la firma de un 'preHandler'
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

// También, aprovechamos de arreglar el 'req.user' que estabas
// ignorando con @ts-ignore en tus rutas
declare module '@fastify/jwt' {
  
  // 2. Aumentamos el tipo de payload que genera 'fastify-jwt'
  export interface FastifyJWT {
    // Este es el payload que 'req.user' tendrá
    user: {
      sub: string;
      // Asumo que tu 'role' es ADMIN o USER, ajústalo si es necesario
      role: 'ADMIN' | 'STUDENT'; 
      // Añade cualquier otro campo que guardes en el token
    }
  }
}