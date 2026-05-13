import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId, getUserId, fail } from '@/lib/api-helpers';
import { assertFolderOwner } from '@/lib/folders';
import { assertPagePermission, resolvePagePermission } from '@/lib/permissions';

const Patch = z.object({
  title: z.string().min(1).max(120).optional(),
  folderId: z.string().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await getUserId();
  const perm = await resolvePagePermission(db, id, userId);
  if (!perm.canView) return fail(403, 'Forbidden');
  const page = await db.page.findUnique({ where: { id } });
  return ok({ page, permission: perm });
});

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canManage');
  const data = await parseBody(req, Patch);
  if (data.folderId) await assertFolderOwner(db, data.folderId, userId);
  const updated = await db.page.update({ where: { id }, data });
  return ok(updated);
});

export const DELETE = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canDelete');
  await db.page.update({ where: { id }, data: { deletedAt: new Date() } });
  return ok({ ok: true });
});
