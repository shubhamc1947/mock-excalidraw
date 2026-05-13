import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, fail, parseBody, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { commentRateLimit } from '@/lib/rate-limit';
import { enqueueCommentNotification } from '@/lib/notifications';

const Post = z.object({ body: z.string().min(1).max(2000) });

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canComment');
  const limit = await commentRateLimit(db, userId);
  if (!limit.allowed) return fail(429, 'Comment rate limit exceeded (10 / 24h)');
  const { body } = await parseBody(req, Post);
  const c = await db.comment.create({ data: { pageId: id, userId, body } });
  await enqueueCommentNotification(db, id, userId, c.id);
  return ok(c);
});

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canView');
  const comments = await db.comment.findMany({
    where: { pageId: id, deletedAt: { isSet: false } },
    orderBy: { createdAt: 'asc' },
  });
  const userIds = Array.from(new Set(comments.map(c => c.userId)));
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, image: true },
  });
  const userMap = new Map(users.map(u => [u.id, { name: u.name, image: u.image }]));
  return ok(comments.map(c => ({ ...c, user: userMap.get(c.userId) ?? null })));
});
