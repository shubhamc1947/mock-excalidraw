import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { ExcalidrawCanvas } from '@/components/editor/excalidraw-canvas';
import { PublicComments } from '@/components/public/public-comments';
import { Button } from '@/components/ui/button';

type Props = { params: Promise<{ publicSlug: string }> };

export default async function PublicViewer({ params }: Props) {
  const { publicSlug } = await params;
  const page = await db.page.findUnique({ where: { publicSlug } });
  if (!page || !page.isPublic || page.deletedAt) notFound();

  const session = await auth();
  const isLoggedIn = !!session?.user;
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-12 px-4 flex items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight shrink-0">
            <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
            mock excalidraw
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm truncate">{page.title || 'Untitled'}</span>
          <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
            read only
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {!isLoggedIn && (
            <Button
              render={<Link href="/login" className="ml-1" />}
              size="sm"
              variant="outline"
            >
              Sign in
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] overflow-hidden">
        <div className="relative">
          <ExcalidrawCanvas
            pageId={page.id}
            initialScene={page.currentSceneJson as any}
            readOnly
          />
        </div>
        <aside className="hidden lg:flex flex-col border-l border-border/60 bg-card/30 overflow-hidden">
          <PublicComments
            slug={publicSlug}
            isLoggedIn={isLoggedIn}
            currentUserId={currentUserId}
          />
        </aside>
      </div>
    </div>
  );
}
