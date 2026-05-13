import { db } from '@/lib/db';
import { handle, ok, requireUserId } from '@/lib/api-helpers';

export const POST = handle(async () => {
  const userId = await requireUserId();
  await db.notification.updateMany({
    where: { recipientUserId: userId, readAt: { isSet: false } },
    data: { readAt: new Date() },
  });
  return ok({ ok: true });
});
