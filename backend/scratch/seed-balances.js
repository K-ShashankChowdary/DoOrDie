import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$connect()
    console.log('Successfully connected to database')
    
    // Update all wallets to have ₹10,000
    const result = await prisma.wallet.updateMany({
      data: {
        availableBalance: 10000.00
      }
    })
    
    console.log(`Successfully updated ${result.count} wallet(s) with ₹10,000 available balance.`)
    
    // Also ensure all users have wallets (if any are missing)
    const users = await prisma.user.findMany({
        include: { wallet: true }
    })
    
    for (const user of users) {
        if (!user.wallet) {
            await prisma.wallet.create({
                data: {
                    userId: user.id,
                    availableBalance: 10000.00
                }
            })
            console.log(`Created new wallet with ₹10,000 for user: ${user.email}`)
        }
    }

  } catch (e) {
    console.error('Operation failed:', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
