import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, ok, parseBody, requireUserId } from '@/lib/api-helpers';
import { assertPagePermission } from '@/lib/permissions';
import { newPublicSlug } from '@/lib/ids';

const Patch = z.object({
  isPublic: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canManage');
  const page = await db.page.findUnique({
    where: { id },
    select: { isPublic: true, publicSlug: true },
  });
  const collabs = await db.collaborator.findMany({ where: { pageId: id } });
  return ok({ ...page, collaborators: collabs });
});

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const userId = await requireUserId();
  await assertPagePermission(db, id, userId, 'canManage');
  const { isPublic } = await parseBody(req, Patch);
  // Always rotate slug on any toggle. This serves as the URL kill switch
  // and matches the spec's "re-toggling on issues a brand-new slug" requirement.
  const data: { isPublic?: boolean; publicSlug: string } = { publicSlug: newPublicSlug() };
  if (typeof isPublic === 'boolean') data.isPublic = isPublic;
  const updated = await db.page.update({
    where: { id },
    data,
    select: { id: true, isPublic: true, publicSlug: true },
  });
  return ok(updated);
});
