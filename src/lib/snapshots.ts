import type { PrismaClient, Prisma } from '@prisma/client';

export const SNAPSHOT_RETENTION = 20;

export async function saveSceneAndSnapshot(
  db: PrismaClient,
  pageId: string,
  userId: string,
  sceneJson: Prisma.InputJsonValue,
  thumbnailDataUrl?: string | null,
) {
  await db.page.update({
    where: { id: pageId },
    data: {
      currentSceneJson: sceneJson,
      ...(thumbnailDataUrl !== undefined ? { thumbnailDataUrl } : {}),
    },
  });
  await db.drawingSnapshot.create({
    data: { pageId, sceneJson, createdByUserId: userId },
  });
  const all = await db.drawingSnapshot.findMany({
    where: { pageId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const toDelete = all.slice(SNAPSHOT_RETENTION).map(s => s.id);
  if (toDelete.length) await db.drawingSnapshot.deleteMany({ where: { id: { in: toDelete } } });
}
