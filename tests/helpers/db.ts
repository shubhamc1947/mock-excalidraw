import type { PrismaClient } from '@prisma/client';

export function getPrisma(): PrismaClient {
  return (globalThis as any).__prisma as PrismaClient;
}
