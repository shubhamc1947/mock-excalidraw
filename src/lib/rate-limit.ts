import type { PrismaClient } from '@prisma/client';

export const COMMENT_LIMIT = 10;
export const COMMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function commentRateLimit(
  db: PrismaClient,
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const since = new Date(Date.now() - COMMENT_WINDOW_MS);
  const count = await db.comment.count({
    where: { userId, createdAt: { gte: since } },
  });
  const remaining = Math.max(0, COMMENT_LIMIT - count);
  return { allowed: count < COMMENT_LIMIT, remaining };
}
