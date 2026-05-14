import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { PageCard } from '@/components/pages/page-card';
import { FadeIn } from '@/components/motion/fade-in';
import { Stagger, StaggerItem } from '@/components/motion/stagger';

export default async function SharedView() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/login');

  const collabs = await db.collaborator.findMany({
    where: { userId },
    select: { pageId: true, role: true, invitedAt: true },
  });
  const pageIds = collabs.map(c => c.pageId);

  const pages =
    pageIds.length > 0
      ? await db.page.findMany({
          where: { id: { in: pageIds }, deletedAt: { isSet: false } },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            isPublic: true,
            thumbnailDataUrl: true,
            updatedAt: true,
          },
        })
      : [];

  return (
    <FadeIn className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Collaboration</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Shared with me</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Pages where someone has invited you as an author or viewer.
        </p>
      </header>

      {pages.length === 0 ? (
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
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Nothing shared yet</h2>
            <p className="text-sm text-muted-foreground">
              When someone invites you to a page, it&apos;ll show up here.
            </p>
          </div>
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
    </FadeIn>
  );
}
