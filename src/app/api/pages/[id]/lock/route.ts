import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { getLockState } from '@/lib/lock';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canView');
  const state = await getLockState(db, id);
  return ok(state);
});
