import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId } from '@/lib/api-helpers';
import { assertFolderOwner } from '@/lib/folders';
import { newPublicSlug } from '@/lib/ids';

const Create = z.object({
  title: z.string().min(1).max(120).default('Untitled'),
  folderId: z.string().nullable().default(null),
});

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { title, folderId } = await parseBody(req, Create);
  if (folderId) await assertFolderOwner(db, folderId, userId);
  const page = await db.page.create({
    data: {
      title,
      folderId,
      ownerId: userId,
      currentSceneJson: { elements: [], appState: {}, files: {} },
      publicSlug: newPublicSlug(),
    },
  });
  return ok(page);
});

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const raw = url.searchParams.get('folderId');
  const folderId = raw === 'null' ? null : raw;
  // For DateTime? null: use { isSet: false }
  const where: any = { ownerId: userId, deletedAt: { isSet: false } };
  if (raw !== null) where.folderId = folderId;
  const pages = await db.page.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, folderId: true, updatedAt: true,
      isPublic: true, thumbnailDataUrl: true,
    },
  });
  return ok(pages);
});
