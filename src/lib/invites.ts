import type { PrismaClient } from '@prisma/client';

export async function backLinkInvitesForUser(
  db: PrismaClient,
  userId: string,
  email: string,
): Promise<string[]> {
  // Find pending invites (userId not yet set)
  // Prisma + MongoDB: use { isSet: false } for optional @db.ObjectId fields
  const pending = await db.collaborator.findMany({
    where: { email, userId: { isSet: false } },
  });
  if (pending.length === 0) return [];
  await db.collaborator.updateMany({
    where: { email, userId: { isSet: false } },
    data: { userId },
  });
  return pending.map(p => p.pageId);
}
