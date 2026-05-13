import { db } from '@/lib/db';
import { ok, fail } from '@/lib/api-helpers';
import { purgeExpiredTrash } from '@/lib/trash';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return fail(401, 'Unauthorized');
  }
  await purgeExpiredTrash(db);
  return ok({ ok: true });
}
