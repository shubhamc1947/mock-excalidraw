import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canView');
  const snaps = await db.drawingSnapshot.findMany({
    where: { pageId: id },
    orderBy: { createdAt: 'desc' },
  });
  // attach author profile to each snapshot
  const userIds = Array.from(new Set(snaps.map(s => s.createdByUserId)));
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, image: true },
  });
  const userMap = new Map(users.map(u => [u.id, { name: u.name, image: u.image }]));
  const enriched = snaps.map(s => ({ ...s, author: userMap.get(s.createdByUserId) ?? null }));
  return ok(enriched);
});
