import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
dotenv.config()
const prisma = new PrismaClient()

async function main() {
  const adminEmail = 'admin@demo.test'
  const pass = await bcrypt.hash('1234', 10)

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash: pass, name: 'Admin', role: 'ADMIN' }
  })

  await prisma.course.upsert({
    where: { slug: 'fansly-master' },
    update: {},
    create: { slug: 'fansly-master', title: 'Fansly Master', shortDesc: 'Algoritmo interno y ventas', price: 85000, currency: 'ARS' }
  })
  await prisma.course.upsert({
    where: { slug: 'fetichista-master' },
    update: {},
    create: { slug: 'fetichista-master', title: 'Fetichista Master', shortDesc: 'Nicho + DM + catálogo', price: 120000, currency: 'ARS' }
  })
}
main().finally(()=>prisma.$disconnect())
