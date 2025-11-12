import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';
export default async function auth(app) {
    const loginSchema = z.object({ email: z.string().email(), password: z.string().min(4) });
    app.post('/auth/login', async (req, reply) => {
        const body = loginSchema.parse(req.body);
        const user = await prisma.user.findUnique({ where: { email: body.email } });
        if (!user || !user.passwordHash)
            return reply.code(401).send({ message: 'Credenciales inválidas' });
        const ok = await bcrypt.compare(body.password, user.passwordHash);
        if (!ok)
            return reply.code(401).send({ message: 'Credenciales inválidas' });
        const token = app.jwt.sign({ sub: user.id, role: user.role, email: user.email });
        return { token };
    });
    app.get('/auth/me', { preHandler: [app.authenticate] }, async (req) => {
        const me = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, email: true, name: true, role: true } });
        return me;
    });
}
//# sourceMappingURL=auth.js.map