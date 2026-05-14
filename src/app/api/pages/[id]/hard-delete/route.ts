import { db } from '@/lib/db';
import { handle, ok, requireUserId, ResponseError } from '@/lib/api-helpers';
import { hardDeletePage } from '@/lib/trash';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  const p = await db.page.findUnique({ where: { id } });
  if (!p || p.ownerId !== userId) throw new ResponseError(403, 'Forbidden');
  await hardDeletePage(db, id);
  return ok({ ok: true });
});
