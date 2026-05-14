import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import { FolderCard } from '@/components/folders/folder-card';
import { PageCard } from '@/components/pages/page-card';
import { NewPageButton } from '@/components/pages/new-page-button';
import { NewFolderDialog } from '@/components/folders/new-folder-dialog';
import { Breadcrumbs } from '@/components/navigation/breadcrumbs';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/motion/fade-in';
import { Stagger, StaggerItem } from '@/components/motion/stagger';

async function resolveBreadcrumbs(
  folderId: string,
): Promise<{ id: string; name: string }[]> {
  const trail: { id: string; name: string }[] = [];
  let cur: string | null = folderId;
  while (cur) {
    const curId: string = cur;
    const f = await db.folder.findUnique({
      where: { id: curId },
      select: { id: true, name: true, parentFolderId: true },
    });
    if (!f) break;
    trail.unshift({ id: f.id, name: f.name });
    cur = f.parentFolderId ?? null;
  }
  return trail;
}

export default async function FolderView({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const folder = await db.folder.findUnique({ where: { id: folderId } });
  if (!folder || folder.ownerId !== userId || folder.deletedAt) notFound();

  const [subs, pages, trail] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: userId, parentFolderId: folder.id, deletedAt: { isSet: false } },
      orderBy: { name: 'asc' },
    }),
    db.page.findMany({
      where: { ownerId: userId, folderId: folder.id, deletedAt: { isSet: false } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true, isPublic: true, thumbnailDataUrl: true },
    }),
    resolveBreadcrumbs(folder.id),
  ]);

  return (
    <FadeIn className="space-y-10">
      <header className="space-y-3">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            ...trail.slice(0, -1).map(t => ({ label: t.name, href: `/folders/${t.id}` })),
            { label: folder.name },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            {folder.name}
          </h1>
          <div className="flex gap-2">
            <NewFolderDialog
              parentFolderId={folder.id}
              trigger={<Button variant="outline">New folder</Button>}
            />
            <NewPageButton folderId={folder.id} />
          </div>
        </div>
      </header>

      {subs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Folders</h2>
          <Stagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {subs.map(f => (
              <StaggerItem key={f.id}>
                <FolderCard id={f.id} name={f.name} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Pages</h2>
        {pages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
            This folder is empty.
          </div>
        ) : (
          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map(p => (
              <StaggerItem key={p.id}>
                <PageCard
                  id={p.id}
                  title={p.title}
                  thumbnailDataUrl={p.thumbnailDataUrl}
                  isPublic={p.isPublic}
                  updatedAt={p.updatedAt.toISOString()}
                />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </FadeIn>
  );
}
