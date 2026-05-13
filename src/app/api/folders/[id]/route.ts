import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId, ResponseError } from '@/lib/api-helpers';
import { assertFolderOwner, wouldCreateCycle } from '@/lib/folders';
import { cascadeSoftDeleteFolder } from '@/lib/trash';

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  parentFolderId: z.string().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertFolderOwner(db, id, userId);
  const data = await parseBody(req, Patch);
  if (data.parentFolderId !== undefined && data.parentFolderId !== null) {
    await assertFolderOwner(db, data.parentFolderId, userId);
    if (await wouldCreateCycle(db, id, data.parentFolderId)) {
      throw new ResponseError(400, 'Move would create a cycle');
    }
  }
  const updated = await db.folder.update({ where: { id }, data });
  return ok(updated);
});

export const DELETE = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertFolderOwner(db, id, userId);
  await cascadeSoftDeleteFolder(db, id);
  return ok({ ok: true });
});
