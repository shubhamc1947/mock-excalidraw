import type { PrismaClient, Folder } from '@prisma/client';

export async function wouldCreateCycle(
  db: PrismaClient,
  folderId: string,
  newParentId: string,
): Promise<boolean> {
  if (folderId === newParentId) return true;
  let cur: string | null = newParentId;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur)) return false;
    seen.add(cur);
    if (cur === folderId) return true;
    const f: Folder | null = await db.folder.findUnique({ where: { id: cur } });
    cur = f?.parentFolderId ?? null;
  }
  return false;
}

export async function listFolderTree(db: PrismaClient, ownerId: string) {
  return db.folder.findMany({
    where: { ownerId, deletedAt: { isSet: false } },
    orderBy: { name: 'asc' },
  });
}

export class FolderForbiddenError extends Error {
  constructor() { super('Forbidden: folder'); }
}

export async function assertFolderOwner(db: PrismaClient, folderId: string, userId: string): Promise<Folder> {
  const f = await db.folder.findUnique({ where: { id: folderId } });
  if (!f || f.ownerId !== userId) throw new FolderForbiddenError();
  return f;
}
