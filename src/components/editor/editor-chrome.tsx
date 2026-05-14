'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HistoryDrawer } from './history-drawer';
import { ShareDialog } from './share-dialog';
import type { SaveStatus } from '@/hooks/use-autosave';

type Props = {
  pageId: string;
  title: string;
  canManage: boolean;
  canEdit: boolean;
  saveStatus: SaveStatus;
  commentsOpen: boolean;
  onToggleComments: () => void;
};

function StatusPill({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />Saving…</span>;
  if (status === 'saved') return <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Saved</span>;
  if (status === 'error') return <span className="text-xs text-destructive inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-destructive" />Save failed</span>;
  return null;
}

export function EditorChrome({ pageId, title, canManage, canEdit, saveStatus, commentsOpen, onToggleComments }: Props) {
  const [t, setT] = useState(title);

  async function saveTitle() {
    if (!canManage || t === title) return;
    await fetch(`/api/pages/${pageId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: t }),
    });
  }

  return (
    <header className="absolute top-0 left-0 right-0 z-20 h-12 px-3 md:px-4 flex items-center gap-2 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <Link href="/" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" aria-label="Back to home">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </Link>

      <input
        className="bg-transparent flex-1 min-w-0 outline-none text-sm font-medium px-2 py-1 rounded hover:bg-secondary/40 focus:bg-secondary/60 transition-colors"
        value={t}
        onChange={e => setT(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        readOnly={!canManage}
        placeholder="Untitled"
      />

      <div className="hidden sm:block">
        <StatusPill status={saveStatus} />
      </div>

      <div className="flex items-center gap-1">
        <HistoryDrawer pageId={pageId} canEdit={canEdit} />
        <Button
          variant={commentsOpen ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onToggleComments}
          aria-pressed={commentsOpen}
          className="gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          Comments
        </Button>
        {canManage && <ShareDialog pageId={pageId} />}
      </div>
    </header>
  );
}
