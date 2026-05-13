import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';
import { searchAll } from '@/lib/search';

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const result = await searchAll(db, userId, q);
  return ok(result);
});
