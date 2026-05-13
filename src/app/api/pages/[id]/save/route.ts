import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId } from '@/lib/api-helpers';
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
  const { sceneJson, thumbnailDataUrl } = await parseBody(req, Save);
  await saveSceneAndSnapshot(db, id, userId, sceneJson, thumbnailDataUrl ?? undefined);
  return ok({ savedAt: new Date().toISOString() });
});
