// Prisma Client Singleton Pattern
// CRITICAL: This prevents connection pool exhaustion in Next.js API routes

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

// Always store singleton to prevent connection pool exhaustion
// This is critical in both development AND production
globalForPrisma.prisma = prisma
