import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$connect()
    console.log('Successfully connected to database')
    const userCount = await prisma.user.count()
    console.log(`User count: ${userCount}`)
  } catch (e) {
    console.error('Database connection failed:', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
