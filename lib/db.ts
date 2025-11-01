import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.

// DEBUG: Check environment variables
console.log('🔍 DEBUG - Environment check:');
console.log('DATABASE_URL FULL:', process.env.DATABASE_URL || 'UNDEFINED!!!');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NEXTAUTH_SECRET exists?:', !!process.env.NEXTAUTH_SECRET);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Connect to the database with retry logic
 */
export async function connectDatabase(retries = 5): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Database connection attempt ${i + 1} failed:`, error);
      if (i < retries - 1) {
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error('Failed to connect to database after multiple attempts');
}

/**
 * Disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('👋 Database disconnected');
}
