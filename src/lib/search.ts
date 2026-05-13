import type { PrismaClient } from '@prisma/client';

export async function searchAll(db: PrismaClient, userId: string, q: string) {
  if (!q.trim()) return { folders: [], pages: [] };

  const collabPageIds = (await db.collaborator.findMany({
    where: { userId },
    select: { pageId: true },
  })).map(c => c.pageId);

  const [folders, pages] = await Promise.all([
    db.folder.findMany({
      where: {
        ownerId: userId,
        deletedAt: { isSet: false },
        name: { contains: q, mode: 'insensitive' },
      },
      take: 10,
      orderBy: { name: 'asc' },
    }),
    db.page.findMany({
      where: {
        deletedAt: { isSet: false },
        title: { contains: q, mode: 'insensitive' },
        OR: [
          { ownerId: userId },
          { id: { in: collabPageIds } },
        ],
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, title: true, updatedAt: true,
        isPublic: true, thumbnailDataUrl: true,
      },
    }),
  ]);

  return { folders, pages };
}
