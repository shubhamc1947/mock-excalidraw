import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import { resolvePagePermission } from '@/lib/permissions';
import { EditorClient } from '@/components/editor/editor-client';

type Props = {
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export default async function EditorPage({ params, searchParams }: Props) {
  const { pageId } = await params;
  const { preview } = await searchParams;

  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const perm = await resolvePagePermission(db, pageId, userId);
  if (!perm.canView) notFound();

  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) notFound();

  let scene: any = page.currentSceneJson;
  let previewing = false;
  if (preview) {
    const snap = await db.drawingSnapshot.findUnique({ where: { id: preview } });
    if (snap?.pageId === page.id) { scene = snap.sceneJson; previewing = true; }
  }

  return (
    <div className="h-screen overflow-hidden">
      <EditorClient
        pageId={page.id}
        title={page.title}
        canManage={perm.canManage}
        canEdit={perm.canEdit}
        canComment={perm.canComment}
        currentUserId={userId}
        initialScene={scene}
        previewing={previewing}
      />
    </div>
  );
}
