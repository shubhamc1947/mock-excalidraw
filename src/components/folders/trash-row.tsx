'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function TrashRow({
  kind,
  id,
  title,
  deletedAt,
}: {
  kind: 'folder' | 'page';
  id: string;
  title: string;
  deletedAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function restore() {
    const url =
      kind === 'folder'
        ? `/api/folders/${id}/restore`
        : `/api/pages/${id}/restore-trash`;
    const r = await fetch(url, { method: 'POST' });
    if (r.ok) startTransition(() => router.refresh());
  }

  const FolderIcon = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );

  const PageIcon = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 15l5-5 4 4 3-3 6 6" />
    </svg>
  );

  return (
    <li className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-muted-foreground shrink-0">
          {kind === 'folder' ? FolderIcon : PageIcon}
        </span>
        <div className="min-w-0">
          <div className="font-medium truncate">{title || 'Untitled'}</div>
          <div className="text-xs text-muted-foreground">
            {kind} · deleted {new Date(deletedAt).toLocaleDateString()}
          </div>
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={restore} disabled={pending}>
        Restore
      </Button>
    </li>
  );
}
