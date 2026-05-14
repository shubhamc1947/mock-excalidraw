'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

type N = {
  id: string;
  type: 'COMMENT' | 'INVITED';
  createdAt: string;
  readAt: string | null;
  pageId: string | null;
  actor: { name: string | null; image: string | null } | null;
  page: { title: string } | null;
};

export function BellMenu() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const r = await fetch('/api/notifications?unread=1');
        if (!alive || !r.ok) return;
        const j = await r.json();
        setUnread(j.unread ?? 0);
      } catch {}
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  async function load() {
    const r = await fetch('/api/notifications');
    if (r.ok) setItems(await r.json());
    fetch('/api/notifications/read', { method: 'POST' }).then(() => setUnread(0));
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 inline-flex h-2 w-2 rounded-full bg-primary ring-2 ring-background" aria-hidden />
            )}
          </Button>
        }
      />
      <SheetContent className="w-[380px] sm:max-w-[380px]">
        <SheetHeader><SheetTitle>Notifications</SheetTitle></SheetHeader>
        <ul className="mt-6 space-y-2 px-4">
          {items.length === 0 ? (
            <li className="text-sm text-muted-foreground py-12 text-center">Nothing yet.</li>
          ) : items.map(n => (
            <li key={n.id} className={`rounded-lg border p-3 text-sm transition-opacity ${n.readAt ? 'opacity-60' : ''}`}>
              <div className="font-medium">{n.actor?.name ?? 'Someone'}</div>
              <div className="text-muted-foreground mt-0.5">
                {n.type === 'COMMENT' && <>commented on <Link className="text-foreground hover:underline" href={`/pages/${n.pageId}`}>{n.page?.title ?? 'a page'}</Link></>}
                {n.type === 'INVITED' && <>invited you to <Link className="text-foreground hover:underline" href={`/pages/${n.pageId}`}>{n.page?.title ?? 'a page'}</Link></>}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
