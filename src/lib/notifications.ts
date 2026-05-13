import type { PrismaClient } from '@prisma/client';

export async function enqueueCommentNotification(
  db: PrismaClient,
  pageId: string,
  actorUserId: string,
  commentId: string,
) {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  if (!page || page.ownerId === actorUserId) return;
  await db.notification.create({
    data: { recipientUserId: page.ownerId, type: 'COMMENT', actorUserId, pageId, commentId },
  });
}

export async function enqueueInviteNotification(
  db: PrismaClient,
  recipientUserId: string,
  actorUserId: string,
  pageId: string,
) {
  if (recipientUserId === actorUserId) return;
  await db.notification.create({
    data: { recipientUserId, type: 'INVITED', actorUserId, pageId },
  });
}
