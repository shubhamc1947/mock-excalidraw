'use client';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
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

export function ExcalidrawCanvas({ pageId, initialScene, readOnly, onSaveStatusChange }: Props) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [scene, setScene] = useState<Scene>(initialScene);

  const save = useCallback(async (s: Scene) => {
    if (readOnly) return;
    const res = await fetch(`/api/pages/${pageId}/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sceneJson: s }),
    });
    if (!res.ok) throw new Error('save failed');
  }, [pageId, readOnly]);

  const status = useAutosave(scene, save, 2000, !readOnly);
  // Surface status to parent
  useMemo(() => { onSaveStatusChange?.(status); return status; }, [status, onSaveStatusChange]);

  const onChange = useCallback((elements: any, appState: any, files: any) => {
    setScene({ elements: Array.from(elements), appState, files });
  }, []);

  return (
    <Excalidraw
      key={`${pageId}-${theme}`}
      initialData={initialScene as any}
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
