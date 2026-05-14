'use client';
import { useEffect, useState } from 'react';

export type LockState = {
  granted: boolean;
  holderUserId: string | null;
  expiresAt: string | null;
} | null;

export function useLockHeartbeat(pageId: string, enabled: boolean): LockState {
  const [state, setState] = useState<LockState>(null);

  useEffect(() => {
    if (!enabled) { setState(null); return; }
    let alive = true;

    async function call(action: 'acquire' | 'heartbeat') {
      try {
        const r = await fetch(`/api/pages/${pageId}/lock/${action}`, { method: 'POST' });
        const j = await r.json();
        if (alive) setState(j);
      } catch {}
    }

    call('acquire');
    const heartbeatId = setInterval(() => call('heartbeat'), 60_000);

    // Poll every 10s when we don't hold the lock, to detect when it frees
    const pollId = setInterval(async () => {
      try {
        const r = await fetch(`/api/pages/${pageId}/lock/acquire`, { method: 'POST' });
        const j = await r.json();
        if (alive) setState(j);
      } catch {}
    }, 10_000);

    const onUnload = () => {
      try { navigator.sendBeacon?.(`/api/pages/${pageId}/lock/release`, new Blob()); } catch {}
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      alive = false;
      clearInterval(heartbeatId);
      clearInterval(pollId);
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, [pageId, enabled]);

  return state;
}
