import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const url = new URL(req.url);

  if (url.searchParams.get('unread') === '1') {
    const count = await db.notification.count({
      where: { recipientUserId: userId, readAt: { isSet: false } },
    });
    return ok({ unread: count });
  }

  const items = await db.notification.findMany({
    where: { recipientUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  // Enrich with actor + page info via batched lookups
  const actorIds = Array.from(new Set(items.map(n => n.actorUserId)));
  const pageIds = Array.from(new Set(items.map(n => n.pageId).filter((x): x is string => !!x)));
  const [actors, pages] = await Promise.all([
    db.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, image: true },
    }),
    db.page.findMany({
      where: { id: { in: pageIds } },
      select: { id: true, title: true },
    }),
  ]);
  const actorMap = new Map(actors.map(a => [a.id, { name: a.name, image: a.image }]));
  const pageMap = new Map(pages.map(p => [p.id, { title: p.title }]));
  const enriched = items.map(n => ({
    ...n,
    actor: actorMap.get(n.actorUserId) ?? null,
    page: n.pageId ? pageMap.get(n.pageId) ?? null : null,
  }));
  return ok(enriched);
});
