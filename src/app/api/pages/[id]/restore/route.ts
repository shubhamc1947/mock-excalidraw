import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId, ResponseError } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { saveSceneAndSnapshot } from '@/lib/snapshots';

const Restore = z.object({ snapshotId: z.string() });

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canEdit');
  const { snapshotId } = await parseBody(req, Restore);
  const snap = await db.drawingSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snap || snap.pageId !== id) throw new ResponseError(404, 'Snapshot not found');
  await saveSceneAndSnapshot(db, id, userId, snap.sceneJson as any);
  return ok({ ok: true });
});
