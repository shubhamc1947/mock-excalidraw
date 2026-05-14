'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function SearchBox() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');

  useEffect(() => { setQ(sp.get('q') ?? ''); }, [sp]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={submit} className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
        </svg>
      </span>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search folders and pages…"
        className="w-full h-9 pl-9 pr-3 text-sm rounded-md bg-secondary/60 border border-transparent focus:border-border focus:bg-background outline-none transition-colors placeholder:text-muted-foreground"
      />
    </form>
  );
}
