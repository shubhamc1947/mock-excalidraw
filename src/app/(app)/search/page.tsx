import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { searchAll } from '@/lib/search';
import { FolderCard } from '@/components/folders/folder-card';
import { PageCard } from '@/components/pages/page-card';
import { FadeIn } from '@/components/motion/fade-in';
import { Stagger, StaggerItem } from '@/components/motion/stagger';

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchView({ searchParams }: Props) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const { q = '' } = await searchParams;
  const { folders, pages } = await searchAll(db, userId, q);
  const total = folders.length + pages.length;

  return (
    <FadeIn className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Search</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {q ? (
            <>
              Results for <span className="text-primary">&ldquo;{q}&rdquo;</span>
            </>
          ) : (
            'Search'
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          {q
            ? `${total} result${total === 1 ? '' : 's'} across folders and pages.`
            : 'Type a query in the top bar to search.'}
        </p>
      </header>

      {q && total === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card/40 px-8 py-16 text-center">
          <div className="mx-auto max-w-sm space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">No matches</h2>
            <p className="text-sm text-muted-foreground">Try a different search term.</p>
          </div>
        </div>
      )}

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

      {pages.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Pages</h2>
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
        </section>
      )}
    </FadeIn>
  );
}
