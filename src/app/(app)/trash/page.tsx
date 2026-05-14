import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { TrashRow } from '@/components/folders/trash-row';
import { FadeIn } from '@/components/motion/fade-in';

export default async function TrashView() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const [folders, pages] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: userId, deletedAt: { isSet: true } },
      orderBy: { deletedAt: 'desc' },
    }),
    db.page.findMany({
      where: { ownerId: userId, deletedAt: { isSet: true } },
      orderBy: { deletedAt: 'desc' },
    }),
  ]);

  const isEmpty = folders.length === 0 && pages.length === 0;

  return (
    <FadeIn className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Trash</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Trash</h1>
        <p className="text-sm text-muted-foreground">
          Items are permanently deleted after 30 days.
        </p>
      </header>

      {isEmpty ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/40 px-8 py-16 text-center">
          <div className="mx-auto max-w-sm space-y-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Trash is empty</h2>
            <p className="text-sm text-muted-foreground">
              Deleted folders and pages will appear here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          {folders.map(f => (
            <TrashRow
              key={f.id}
              kind="folder"
              id={f.id}
              title={f.name}
              deletedAt={f.deletedAt!.toISOString()}
            />
          ))}
          {pages.map(p => (
            <TrashRow
              key={p.id}
              kind="page"
              id={p.id}
              title={p.title}
              deletedAt={p.deletedAt!.toISOString()}
            />
          ))}
        </ul>
      )}
    </FadeIn>
  );
}
