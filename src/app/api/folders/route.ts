import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId } from '@/lib/api-helpers';
import { assertFolderOwner } from '@/lib/folders';

const CreateFolder = z.object({
  name: z.string().min(1).max(80),
  parentFolderId: z.string().nullable(),
});

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { name, parentFolderId } = await parseBody(req, CreateFolder);
  if (parentFolderId) await assertFolderOwner(db, parentFolderId, userId);
  const folder = await db.folder.create({ data: { name, parentFolderId, ownerId: userId } });
  return ok(folder);
});

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const raw = url.searchParams.get('parentFolderId');

  // Build the base where clause — exclude soft-deleted folders
  const where: Record<string, unknown> = { ownerId: userId, deletedAt: { isSet: false } };

  // If parentFolderId param is present, filter by it
  if (raw !== null) {
    if (raw === 'null') {
      // Root folders: parentFolderId is null (String? stored as MongoDB null)
      where.parentFolderId = null;
    } else {
      where.parentFolderId = raw;
    }
  }

  const folders = await db.folder.findMany({ where: where as any, orderBy: { name: 'asc' } });
  return ok(folders);
});
