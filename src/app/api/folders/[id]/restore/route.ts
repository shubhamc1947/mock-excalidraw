import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { assertFolderOwner } from '@/lib/folders';
import { restoreFolder } from '@/lib/trash';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertFolderOwner(db, id, userId);
  await restoreFolder(db, id);
  return ok({ ok: true });
});
