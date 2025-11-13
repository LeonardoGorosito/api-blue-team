import 'fastify';

// 1. Define el Payload del usuario inyectado por fastify-jwt
// Esta interfaz debe coincidir exactamente con lo que firmas en tu token.
interface UserPayload {
    sub: string;
    role: 'ADMIN' | 'USER'; 
    email: string; // <-- Propiedad que has añadido en tu archivo original
    // Puedes añadir más propiedades aquí (ej: name, lastName)
}

// Aumentación del módulo 'fastify'
declare module 'fastify' {
    
    // Extensión de la INSTANCIA (FastifyInstance)
    interface FastifyInstance {
        // fastify-jwt añade la propiedad 'jwt' a la instancia de Fastify
        jwt: {
            sign: (payload: any, options?: any) => string
        }
        // Decorador 'authenticate' que creaste en server.ts
        authenticate: (request: any, reply: any) => Promise<void>
    }

    // Extensión del REQUEST (FastifyRequest)
    interface FastifyRequest {
        // Propiedad inyectada por fastify-jwt después de req.jwtVerify()
        user: UserPayload;
        
        // Propiedad/método inyectado por @fastify/multipart
        // Permite usar await req.file() sin el @ts-ignore
        file: () => Promise<import('@fastify/multipart').MultipartFile | undefined>;
    }

    // Extensión del REPLY (FastifyReply)
    interface FastifyReply {
        // Método inyectado por @fastify/static
        sendFile(filename: string): import('fastify').FastifyReply;
    }
}