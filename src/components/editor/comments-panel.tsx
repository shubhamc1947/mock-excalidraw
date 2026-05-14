'use client';
import { useEffect, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  user: { name: string | null; image: string | null } | null;
};

export function CommentsPanel({ pageId, open, canComment, currentUserId, isOwner, onClose }: {
  pageId: string;
  open: boolean;
  canComment: boolean;
  currentUserId: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const [list, setList] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const r = await fetch(`/api/pages/${pageId}/comments`);
    if (r.ok) setList(await r.json());
  }
  useEffect(() => { if (open) load(); }, [open, pageId]);

  async function post() {
    if (!body.trim()) return;
    setError(null);
    const r = await fetch(`/api/pages/${pageId}/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (r.status === 429) { setError('You hit your daily comment limit (10 / 24h).'); return; }
    if (!r.ok) { setError('Failed to post.'); return; }
    setBody('');
    await load();
  }

  async function remove(id: string) {
    const r = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (r.ok) startTransition(load);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-0 top-12 bottom-0 w-[360px] z-10 border-l border-border bg-background flex flex-col shadow-2xl"
        >
          <header className="h-12 px-4 flex items-center justify-between border-b border-border/60">
            <h3 className="font-medium text-sm">Comments</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close comments">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </Button>
          </header>

          <ul className="flex-1 overflow-y-auto p-4 space-y-4">
            {list.length === 0 ? (
              <li className="text-sm text-muted-foreground text-center py-12">
                No comments yet.
              </li>
            ) : list.map(c => (
              <li key={c.id} className="space-y-1">
                <div className="flex items-start gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    {c.user?.image && <AvatarImage src={c.user.image} alt={c.user.name ?? ''} />}
                    <AvatarFallback className="text-[10px]">
                      {(c.user?.name ?? 'U').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium truncate">{c.user?.name ?? 'User'}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap mt-0.5">{c.body}</p>
                    {(c.userId === currentUserId || isOwner) && (
                      <button
                        onClick={() => remove(c.id)}
                        disabled={pending}
                        className="text-[11px] text-muted-foreground hover:text-destructive mt-1"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {canComment && (
            <div className="p-4 border-t border-border/60 space-y-2">
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={3}
                placeholder="Add a comment…"
                className="w-full resize-none text-sm rounded-md border bg-background px-3 py-2 outline-none focus:border-primary"
              />
              <div className="flex justify-between items-center">
                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : <span />}
                <Button size="sm" onClick={post} disabled={!body.trim()}>Post</Button>
              </div>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
