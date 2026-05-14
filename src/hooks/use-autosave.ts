'use client';
import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosave<T>(
  value: T,
  save: (v: T) => Promise<void>,
  delayMs = 2000,
  enabled = true,
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timer = useRef<NodeJS.Timeout | null>(null);
  const latest = useRef<T>(value);
  const isFirst = useRef(true);
  latest.current = value;

  useEffect(() => {
    if (!enabled) return;
    if (isFirst.current) { isFirst.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus('saving');
      try { await save(latest.current); setStatus('saved'); }
      catch { setStatus('error'); }
    }, delayMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, delayMs, enabled, save]);

  return status;
}
