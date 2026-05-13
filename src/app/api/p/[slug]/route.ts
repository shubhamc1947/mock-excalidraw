import { db } from '@/lib/db';
import { handle, ok, fail } from '@/lib/api-helpers';

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const { slug } = await params;
  const page = await db.page.findUnique({ where: { publicSlug: slug } });
  if (!page || !page.isPublic || page.deletedAt) return fail(404, 'Not found');
  return ok({
    id: page.id,
    title: page.title,
    sceneJson: page.currentSceneJson,
    isPublic: page.isPublic,
  });
});
