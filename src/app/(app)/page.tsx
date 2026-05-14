import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { FolderCard } from '@/components/folders/folder-card';
import { PageCard } from '@/components/pages/page-card';
import { NewPageButton } from '@/components/pages/new-page-button';
import { NewFolderDialog } from '@/components/folders/new-folder-dialog';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/motion/fade-in';
import { Stagger, StaggerItem } from '@/components/motion/stagger';

export default async function Dashboard() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const [folders, pages] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: userId, parentFolderId: null, deletedAt: { isSet: false } },
      orderBy: { name: 'asc' },
      take: 12,
    }),
    db.page.findMany({
      where: { ownerId: userId, folderId: null, deletedAt: { isSet: false } },
      orderBy: { updatedAt: 'desc' },
      take: 24,
      select: { id: true, title: true, updatedAt: true, isPublic: true, thumbnailDataUrl: true },
    }),
  ]);

  const empty = folders.length === 0 && pages.length === 0;
  const name = session?.user?.name?.split(' ')[0] ?? 'there';

  return (
    <FadeIn className="space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Home</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            Welcome back, {name}.
          </h1>
        </div>
        <div className="flex gap-2">
          <NewFolderDialog
            parentFolderId={null}
            trigger={<Button variant="outline">New folder</Button>}
          />
          <NewPageButton folderId={null} />
        </div>
      </header>

      {empty ? (
        <FadeIn
          delay={0.1}
          className="rounded-3xl border border-dashed border-border bg-card/40 px-8 py-16 md:py-24 text-center"
        >
          <div className="mx-auto max-w-md space-y-6">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 17l6-6 4 4 8-8M14 7h7v7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Start your first drawing</h2>
              <p className="text-sm text-muted-foreground">
                A blank canvas, infinite shapes. Sketch a diagram, plan a system, draw an idea.
              </p>
            </div>
            <NewPageButton folderId={null} label="Create your first page" size="lg" />
          </div>
        </FadeIn>
      ) : (
        <>
          {folders.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-medium text-muted-foreground">Folders</h2>
              <Stagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {folders.map(f => (
                  <StaggerItem key={f.id}>
                    <FolderCard id={f.id} name={f.name} />
                  </StaggerItem>
                ))}
              </Stagger>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">Recent pages</h2>
            </div>
            {pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pages at the root yet — create one or open a folder.
              </p>
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
        </>
      )}
    </FadeIn>
  );
}
