'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function NewPageButton({
  folderId,
  label = 'New page',
  size = 'default',
}: {
  folderId: string | null;
  label?: string;
  size?: 'sm' | 'default' | 'lg';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  async function create() {
    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', folderId }),
    });
    if (res.ok) {
      const p = await res.json();
      startTransition(() => router.push(`/pages/${p.id}`));
    }
  }
  return (
    <Button onClick={create} size={size} disabled={pending} className="gap-2">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {label}
    </Button>
  );
}
