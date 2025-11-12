import { prisma } from '../db.js';
export default async function courses(app) {
    app.get('/courses', async () => {
        const items = await prisma.course.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
        return items;
    });
}
//# sourceMappingURL=courses.js.map