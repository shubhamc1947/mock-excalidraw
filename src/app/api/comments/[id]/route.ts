import { db } from '@/lib/db';
import { handle, ok, requireUserId, ResponseError } from '@/lib/api-helpers';

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  const c = await db.comment.findUnique({ where: { id } });
  if (!c) throw new ResponseError(404, 'Comment not found');
  const page = await db.page.findUnique({
    where: { id: c.pageId },
    select: { ownerId: true },
  });
  if (c.userId !== userId && page?.ownerId !== userId) {
    throw new ResponseError(403, 'Forbidden');
  }
  await db.comment.update({ where: { id }, data: { deletedAt: new Date() } });
  return ok({ ok: true });
});
