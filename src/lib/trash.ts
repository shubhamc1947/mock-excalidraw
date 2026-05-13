import type { PrismaClient } from '@prisma/client';

export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function cascadeSoftDeleteFolder(db: PrismaClient, folderId: string) {
  const now = new Date();
  await db.folder.update({ where: { id: folderId }, data: { deletedAt: now } });
  const children = await db.folder.findMany({
    where: { parentFolderId: folderId, deletedAt: { isSet: false } },
  });
  for (const c of children) await cascadeSoftDeleteFolder(db, c.id);
  await db.page.updateMany({
    where: { folderId, deletedAt: { isSet: false } },
    data: { deletedAt: now },
  });
}

export async function restoreFolder(db: PrismaClient, folderId: string) {
  await db.folder.update({ where: { id: folderId }, data: { deletedAt: null } });
}

export async function restorePage(db: PrismaClient, pageId: string) {
  await db.page.update({ where: { id: pageId }, data: { deletedAt: null } });
}

export async function purgeExpiredTrash(db: PrismaClient) {
  const cutoff = new Date(Date.now() - TRASH_TTL_MS);
  // Pages first (cascade their dependents). Use date-range filter instead of `not: null`
  // because Prisma+Mongo's null filter on DateTime needs `isSet`-style queries.
  const oldPages = await db.page.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true },
  });
  const pageIds = oldPages.map(p => p.id);
  if (pageIds.length) {
    await db.drawingSnapshot.deleteMany({ where: { pageId: { in: pageIds } } });
    await db.collaborator.deleteMany({ where: { pageId: { in: pageIds } } });
    await db.comment.deleteMany({ where: { pageId: { in: pageIds } } });
    await db.notification.deleteMany({ where: { pageId: { in: pageIds } } });
    await db.page.deleteMany({ where: { id: { in: pageIds } } });
  }
  await db.folder.deleteMany({ where: { deletedAt: { lt: cutoff } } });
}
