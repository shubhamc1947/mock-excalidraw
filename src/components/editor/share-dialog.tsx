'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Collab = { id: string; email: string; role: 'AUTHOR'|'VIEWER'; userId: string | null };
type ShareData = { isPublic: boolean; publicSlug: string | null; collaborators: Collab[] };

export function ShareDialog({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ShareData | null>(null);

  async function load() {
    const r = await fetch(`/api/pages/${pageId}/share`);
    if (r.ok) setData(await r.json());
  }
  useEffect(() => { if (open) load(); }, [open, pageId]);

  async function togglePublic(next: boolean) {
    const r = await fetch(`/api/pages/${pageId}/share`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPublic: next }),
    });
    if (r.ok) {
      const updated = await r.json();
      setData((d) => d ? { ...d, isPublic: updated.isPublic, publicSlug: updated.publicSlug } : d);
    }
  }

  const url = typeof window !== 'undefined' && data?.publicSlug
    ? `${window.location.origin}/p/${data.publicSlug}` : '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Share</Button>} />
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader><DialogTitle>Share this page</DialogTitle></DialogHeader>

        {!data ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Public link section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Public link</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Anyone with the link can view {data.isPublic ? '— and signed-in users can comment' : '(currently disabled)'}.
                  </div>
                </div>
                <Button
                  variant={data.isPublic ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => togglePublic(!data.isPublic)}
                >
                  {data.isPublic ? 'On' : 'Off'}
                </Button>
              </div>
              {data.isPublic && (
                <div className="flex items-center gap-2">
                  <Input readOnly value={url} className="text-xs font-mono" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigator.clipboard?.writeText(url)}
                  >
                    Copy
                  </Button>
                </div>
              )}
            </section>

            <div className="border-t border-border" />

            {/* Collaborators section */}
            <CollaboratorsSection
              pageId={pageId}
              collaborators={data.collaborators}
              onChange={(next) => setData(d => d ? { ...d, collaborators: next } : d)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CollaboratorsSection({ pageId, collaborators, onChange }: {
  pageId: string;
  collaborators: Collab[];
  onChange: (next: Collab[]) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'AUTHOR'|'VIEWER'>('AUTHOR');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch(`/api/pages/${pageId}/share`);
    if (r.ok) {
      const j = await r.json();
      onChange(j.collaborators);
    }
  }

  async function add() {
    if (!email.trim()) return;
    setPending(true); setError(null);
    try {
      const r = await fetch(`/api/pages/${pageId}/share/collaborators`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? 'Failed to invite');
      } else {
        setEmail('');
        await refresh();
      }
    } finally { setPending(false); }
  }

  async function remove(id: string) {
    await fetch(`/api/pages/${pageId}/share/collaborators`, {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ collaboratorId: id }),
    });
    await refresh();
  }

  return (
    <section className="space-y-3">
      <div>
        <div className="font-medium text-sm">People with access</div>
        <div className="text-xs text-muted-foreground mt-0.5">Invite by email — they&apos;ll be linked on first sign-in.</div>
      </div>
      <div className="flex gap-2">
        <Input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="email@example.com"
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value as 'AUTHOR'|'VIEWER')}
          className="text-sm rounded-md border bg-background px-3"
        >
          <option value="AUTHOR">Author</option>
          <option value="VIEWER">Viewer</option>
        </select>
        <Button size="sm" onClick={add} disabled={!email.trim() || pending}>Invite</Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {collaborators.length > 0 && (
        <ul className="rounded-lg border divide-y divide-border">
          {collaborators.map(c => (
            <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">{c.email}</div>
                <div className="text-xs text-muted-foreground">
                  {c.role.toLowerCase()}{c.userId ? '' : ' · pending sign-in'}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
