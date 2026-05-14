'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  user: { name: string | null; image: string | null } | null;
};

export function PublicComments({
  slug,
  isLoggedIn,
  currentUserId,
}: {
  slug: string;
  isLoggedIn: boolean;
  currentUserId: string | null;
}) {
  const [list, setList] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await fetch(`/api/p/${slug}/comments`);
    if (r.ok) setList(await r.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function post() {
    if (!body.trim()) return;
    setError(null);
    const r = await fetch(`/api/p/${slug}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (r.status === 429) {
      setError('You hit your daily comment limit (10 / 24h).');
      return;
    }
    if (!r.ok) {
      setError('Failed to post.');
      return;
    }
    setBody('');
    load();
  }

  return (
    <>
      <header className="h-12 px-4 flex items-center border-b border-border/60 shrink-0">
        <h3 className="font-medium text-sm">Comments</h3>
      </header>

      <ul className="flex-1 overflow-y-auto p-4 space-y-4">
        {list.length === 0 ? (
          <li className="text-sm text-muted-foreground text-center py-12">
            Be the first to leave a comment.
          </li>
        ) : (
          list.map(c => (
            <li key={c.id} className="flex items-start gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                {c.user?.image && (
                  <AvatarImage src={c.user.image} alt={c.user.name ?? ''} />
                )}
                <AvatarFallback className="text-[10px]">
                  {(c.user?.name ?? 'U').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {c.user?.name ?? 'User'}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap mt-0.5">{c.body}</p>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="p-4 border-t border-border/60 shrink-0">
        {isLoggedIn ? (
          <div className="space-y-2">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              placeholder="Add a comment…"
              className="w-full resize-none text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-primary transition-colors"
            />
            <div className="flex justify-between items-center">
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : (
                <span />
              )}
              <Button size="sm" onClick={post} disabled={!body.trim()}>
                Post
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-4 text-sm text-center space-y-2">
            <p className="text-muted-foreground">Sign in to leave a comment.</p>
            <Button size="sm" render={<Link href="/login" />}>
              Sign in
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
