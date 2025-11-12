import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function requireAuth(): (req: FastifyRequest, reply: FastifyReply) => Promise<undefined>;
export declare function requireRole(role: 'ADMIN' | 'STUDENT'): (req: FastifyRequest, reply: FastifyReply) => Promise<undefined>;
//# sourceMappingURL=auth.d.ts.map