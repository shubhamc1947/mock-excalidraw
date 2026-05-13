import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, fail, parseBody, requireUserId } from '@/lib/api-helpers';
import { commentRateLimit } from '@/lib/rate-limit';
import { enqueueCommentNotification } from '@/lib/notifications';

const Post = z.object({ body: z.string().min(1).max(2000) });

type Ctx = { params: Promise<{ slug: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const { slug } = await params;
  const userId = await requireUserId();
  const page = await db.page.findUnique({
    where: { publicSlug: slug },
    select: { id: true, isPublic: true, deletedAt: true },
  });
  if (!page || !page.isPublic || page.deletedAt) return fail(404, 'Not found');
  const limit = await commentRateLimit(db, userId);
  if (!limit.allowed) return fail(429, 'Comment rate limit exceeded (10 / 24h)');
  const { body } = await parseBody(req, Post);
  const c = await db.comment.create({ data: { pageId: page.id, userId, body } });
  await enqueueCommentNotification(db, page.id, userId, c.id);
  return ok(c);
});

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { slug } = await params;
  const page = await db.page.findUnique({
    where: { publicSlug: slug },
    select: { id: true, isPublic: true, deletedAt: true },
  });
  if (!page || !page.isPublic || page.deletedAt) return fail(404, 'Not found');
  const comments = await db.comment.findMany({
    where: { pageId: page.id, deletedAt: { isSet: false } },
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
