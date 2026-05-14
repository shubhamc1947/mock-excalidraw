import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  await requireUserId();
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    select: { name: true, image: true },
  });
  return ok(u ?? { name: null, image: null });
});
