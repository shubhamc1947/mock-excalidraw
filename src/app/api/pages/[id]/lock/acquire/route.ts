import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { acquireLock } from '@/lib/lock';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canEdit');
  const r = await acquireLock(db, id, userId);
  return ok(r, r.granted ? 200 : 409);
});
