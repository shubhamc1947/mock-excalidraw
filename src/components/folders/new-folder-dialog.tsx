'use client';
import { cloneElement, isValidElement, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NewFolderDialog({
  parentFolderId,
  trigger,
}: {
  parentFolderId: string | null;
  trigger?: React.ReactNode;
}) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function submit() {
    if (!name.trim()) return;
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), parentFolderId }),
    });
    if (res.ok) {
      setName('');
      setOpen(false);
      startTransition(() => router.refresh());
    }
  }

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
      aria-label="New folder"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </Button>
  );

  const triggerEl = trigger ?? defaultTrigger;
  const triggerWithHandler = isValidElement(triggerEl)
    ? cloneElement(triggerEl as React.ReactElement<{ onClick?: () => void }>, {
        onClick: () => setOpen(true),
      })
    : triggerEl;

  return (
    <>
      {triggerWithHandler}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sketches"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') submit();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!name.trim() || pending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
