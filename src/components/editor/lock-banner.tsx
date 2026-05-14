'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  holderName: string;
  expiresAt: string;
  onTakeover: () => void;
};

export function LockBanner({ holderName, expiresAt, onTakeover }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
  const expired = remaining <= 0;

  return (
    <div className="absolute top-12 left-0 right-0 z-10 px-3 py-2 bg-amber-500/10 dark:bg-amber-400/10 border-b border-amber-500/20 dark:border-amber-400/20 backdrop-blur-md text-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
        <span className="truncate">
          {expired
            ? <><strong>{holderName}</strong>&apos;s editing session expired.</>
            : <><strong>{holderName}</strong> is editing — read-only. Take over in {m}:{s}.</>}
        </span>
      </div>
      {expired && (
        <Button size="sm" onClick={onTakeover}>Take over</Button>
      )}
    </div>
  );
}
