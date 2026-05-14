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
    let heartbeatId: ReturnType<typeof setInterval> | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;

    function clearTimers() {
      if (heartbeatId) { clearInterval(heartbeatId); heartbeatId = null; }
      if (pollId) { clearInterval(pollId); pollId = null; }
    }

    async function acquire() {
      try {
        const r = await fetch(`/api/pages/${pageId}/lock/acquire`, { method: 'POST' });
        const j = await r.json();
        if (!alive) return j;
        setState(j);
        applyTimerState(j.granted);
        return j;
      } catch { return null; }
    }
    async function beat() {
      try {
        const r = await fetch(`/api/pages/${pageId}/lock/heartbeat`, { method: 'POST' });
        const j = await r.json();
        if (!alive) return;
        setState(j);
        applyTimerState(j.granted);
      } catch {}
    }
    async function readState() {
      try {
        const r = await fetch(`/api/pages/${pageId}/lock`);
        if (!r.ok) return;
        const j = await r.json();
        if (!alive) return;
        setState(j);
        // If the lock just freed up, surface that — but DO NOT auto-acquire.
        // The user must click "Take over" to claim.
      } catch {}
    }

    function applyTimerState(holding: boolean) {
      clearTimers();
      if (holding) {
        heartbeatId = setInterval(beat, 60_000);
      } else {
        pollId = setInterval(readState, 10_000);
      }
    }

    acquire();

    const onUnload = () => {
      try { navigator.sendBeacon?.(`/api/pages/${pageId}/lock/release`, new Blob()); } catch {}
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      alive = false;
      clearTimers();
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, [pageId, enabled]);

  return state;
}
