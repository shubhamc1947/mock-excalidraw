import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { releaseLock } from '@/lib/lock';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await releaseLock(db, id, userId);
  return ok({ ok: true });
});
