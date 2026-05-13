import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId, ResponseError } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { enqueueInviteNotification } from '@/lib/notifications';

const AddBody = z.object({
  email: z.string().email(),
  role: z.enum(['AUTHOR', 'VIEWER']),
});
const RemoveBody = z.object({ collaboratorId: z.string() });

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canManage');
  const { email, role } = await parseBody(req, AddBody);

  const existing = await db.user.findUnique({ where: { email } });
  const collab = await db.collaborator.upsert({
    where: { pageId_email: { pageId: id, email } },
    create: { pageId: id, email, role, invitedByUserId: userId, userId: existing?.id ?? null },
    update: { role, userId: existing?.id ?? null },
  });

  if (existing) {
    await enqueueInviteNotification(db, existing.id, userId, id);
  }

  return ok(collab);
});

export const DELETE = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canManage');
  const { collaboratorId } = await parseBody(req, RemoveBody);
  const c = await db.collaborator.findUnique({ where: { id: collaboratorId } });
  if (!c || c.pageId !== id) throw new ResponseError(404, 'Collaborator not found');
  await db.collaborator.delete({ where: { id: collaboratorId } });
  return ok({ ok: true });
});
