import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId, fail } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { saveSceneAndSnapshot } from '@/lib/snapshots';

const Save = z.object({
  sceneJson: z.any(),
  thumbnailDataUrl: z.string().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canEdit');
  const page = await db.page.findUnique({
    where: { id },
    select: { editingUserId: true, editingExpiresAt: true },
  });
  const heldByMe = page?.editingUserId === userId
    && page?.editingExpiresAt
    && page.editingExpiresAt.getTime() > Date.now();
  if (!heldByMe) return fail(409, 'You do not hold the edit lock');
  const { sceneJson, thumbnailDataUrl } = await parseBody(req, Save);
  await saveSceneAndSnapshot(db, id, userId, sceneJson, thumbnailDataUrl ?? undefined);
  return ok({ savedAt: new Date().toISOString() });
});
