import { PrismaClient } from '@prisma/client';

/**
 * Prisma client — same singleton pattern as the Attendance site.
 *
 * NOTE: the client is created LAZILY and only when DATABASE_URL is set.
 * This lets the site run with no database configured (registrations then
 * fall back to a local counter — see lib/membership.ts).
 */
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const hasDatabase = !!process.env.DATABASE_URL;

export function getPrisma(): PrismaClient | null {
  if (!hasDatabase) return null;
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ log: ['warn', 'error'] });
  }
  return globalForPrisma.prisma;
}
