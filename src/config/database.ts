import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export function getDatabaseClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    const client = getDatabaseClient();
    await client.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    if (prisma) {
      await prisma.$disconnect();
      console.log('Database disconnected successfully');
    }
  } catch (error) {
    console.error('Failed to disconnect from database:', error);
    throw error;
  }
}
