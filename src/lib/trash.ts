import type { PrismaClient } from '@prisma/client';

export async function cascadeSoftDeleteFolder(db: PrismaClient, folderId: string) {
  const now = new Date();
  await db.folder.update({ where: { id: folderId }, data: { deletedAt: now } });
  const children = await db.folder.findMany({ where: { parentFolderId: folderId, deletedAt: { isSet: false } } });
  for (const c of children) await cascadeSoftDeleteFolder(db, c.id);
  await db.page.updateMany({ where: { folderId, deletedAt: { isSet: false } }, data: { deletedAt: now } });
}
