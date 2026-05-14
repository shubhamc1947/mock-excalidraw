'use client';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

type Snapshot = {
  id: string;
  createdAt: string;
  author: { name: string | null; image: string | null } | null;
};

export function HistoryDrawer({ pageId, canEdit }: { pageId: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/pages/${pageId}/snapshots`);
      if (r.ok) setItems(await r.json());
    } finally { setLoading(false); }
  }

  async function restore(snapshotId: string) {
    const r = await fetch(`/api/pages/${pageId}/restore`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ snapshotId }),
    });
    if (r.ok) {
      setOpen(false);
      router.refresh();
      // Reload the editor with the restored scene
      window.location.reload();
    }
  }

  function preview(snapshotId: string) {
    setOpen(false);
    router.push(`/pages/${pageId}?preview=${snapshotId}`);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <SheetTrigger render={
        <Button variant="ghost" size="sm" className="gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 3"/>
          </svg>
          History
        </Button>
      } />
      <SheetContent className="w-[400px] sm:max-w-[400px]">
        <SheetHeader><SheetTitle>Version history</SheetTitle></SheetHeader>
        <div className="px-4 mt-6">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No saved versions yet.</p>
          )}
          {!loading && items.length > 0 && (
            <ol className="space-y-2">
              {items.map((s, i) => (
                <li key={s.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {i === 0 ? 'Latest' : `${i} version${i > 1 ? 's' : ''} ago`}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">by {s.author?.name ?? 'Unknown'}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {i !== 0 && <Button size="sm" variant="ghost" onClick={() => preview(s.id)}>Preview</Button>}
                    {i !== 0 && canEdit && <Button size="sm" onClick={() => restore(s.id)}>Restore</Button>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
