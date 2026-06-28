import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const students = await prisma.registration.findMany({ orderBy: { id: 'asc' } })
  for (let i = 0; i < students.length; i++) {
    const newNo = 1000 + students[i].id
    await prisma.registration.update({ where: { id: students[i].id }, data: { membershipNo: newNo } })
  }
  console.log('Fixed', students.length, 'students')
}
main().catch(console.error).finally(() => prisma.$disconnect())
