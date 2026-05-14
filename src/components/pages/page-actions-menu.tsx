'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PageActionsMenu({ pageId, currentTitle }: { pageId: string; currentTitle: string }) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [, startTransition] = useTransition();

  async function rename() {
    if (!title.trim() || title === currentTitle) { setRenameOpen(false); return; }
    const r = await fetch(`/api/pages/${pageId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    });
    if (r.ok) { setRenameOpen(false); startTransition(() => router.refresh()); }
  }

  async function trash() {
    if (!confirm('Move this page to trash?')) return;
    const r = await fetch(`/api/pages/${pageId}`, { method: 'DELETE' });
    if (r.ok) startTransition(() => router.refresh());
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Page actions"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        } />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setTitle(currentTitle); setRenameOpen(true); }}>
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); trash(); }} className="text-destructive">
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Rename page</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rename-title">Title</Label>
            <Input id="rename-title" value={title} onChange={e => setTitle(e.target.value)}
              autoFocus onKeyDown={(e) => { if (e.key === 'Enter') rename(); }} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={rename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
