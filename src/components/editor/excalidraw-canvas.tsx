'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAutosave } from '@/hooks/use-autosave';

// Excalidraw ships its own CSS — import it
import '@excalidraw/excalidraw/index.css';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full grid place-items-center bg-card text-muted-foreground text-sm">
        Loading editor…
      </div>
    ),
  },
);

export type Scene = { elements: any[]; appState: any; files: any };

type Props = {
  pageId: string;
  initialScene: Scene;
  readOnly: boolean;
  onSaveStatusChange?: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
};

/**
 * Strip non-serialisable / runtime-only fields from Excalidraw's appState before:
 * (a) feeding a JSON-roundtripped scene back to the editor (Excalidraw expects
 *     `collaborators` as a Map — Mongo gives us `{}`), and
 * (b) saving the scene back to the server (no point persisting transient runtime state).
 */
function sanitiseScene(scene: Scene): Scene {
  if (!scene) return { elements: [], appState: {}, files: {} };
  const appState = { ...(scene.appState ?? {}) };
  // collaborators must be a Map at runtime; remove the rehydrated plain object
  // so Excalidraw initialises a fresh empty Map.
  delete (appState as { collaborators?: unknown }).collaborators;
  // collaboration-related transient fields
  delete (appState as { selectedElementIds?: unknown }).selectedElementIds;
  return {
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState,
    files: scene.files ?? {},
  };
}

export function ExcalidrawCanvas({ pageId, initialScene, readOnly, onSaveStatusChange }: Props) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const cleanInitial = useMemo(() => sanitiseScene(initialScene), [initialScene]);
  const [scene, setScene] = useState<Scene>(cleanInitial);

  const save = useCallback(async (s: Scene) => {
    if (readOnly) return;
    const res = await fetch(`/api/pages/${pageId}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sceneJson: sanitiseScene(s) }),
    });
    if (!res.ok) throw new Error('save failed');
  }, [pageId, readOnly]);

  const status = useAutosave(scene, save, 2000, !readOnly);

  // Surface status to parent (was incorrectly inside useMemo)
  useEffect(() => { onSaveStatusChange?.(status); }, [status, onSaveStatusChange]);

  const onChange = useCallback((elements: any, appState: any, files: any) => {
    setScene({ elements: Array.from(elements), appState, files });
  }, []);

  return (
    <Excalidraw
      key={`${pageId}-${theme}`}
      initialData={cleanInitial as any}
      onChange={onChange}
      viewModeEnabled={readOnly}
      theme={theme}
      UIOptions={{
        canvasActions: {
          changeViewBackgroundColor: true,
          clearCanvas: !readOnly,
          export: { saveFileToDisk: true },
          loadScene: false,
          saveAsImage: true,
          saveToActiveFile: false,
          toggleTheme: false, /* we control theme via next-themes */
        },
      }}
    />
  );
}
