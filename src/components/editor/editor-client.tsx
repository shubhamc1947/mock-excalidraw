'use client';
import { useEffect, useState } from 'react';
import { EditorChrome } from './editor-chrome';
import { ExcalidrawCanvas, type Scene } from './excalidraw-canvas';
import { LockBanner } from './lock-banner';
import { CommentsPanel } from './comments-panel';
import { useLockHeartbeat } from '@/hooks/use-lock-heartbeat';
import type { SaveStatus } from '@/hooks/use-autosave';

type Props = {
  pageId: string;
  title: string;
  canManage: boolean;
  canEdit: boolean;
  canComment: boolean;
  currentUserId: string;
  initialScene: Scene;
  previewing: boolean;
};

export function EditorClient({
  pageId, title, canManage, canEdit, canComment, currentUserId,
  initialScene, previewing,
}: Props) {
  const lock = useLockHeartbeat(pageId, canEdit && !previewing);
  const [holderName, setHolderName] = useState('Someone');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const someoneElseHoldsLock = lock?.granted === false && lock.holderUserId !== null && lock.holderUserId !== currentUserId;

  useEffect(() => {
    if (someoneElseHoldsLock && lock?.holderUserId) {
      fetch(`/api/users/${lock.holderUserId}`)
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u?.name) setHolderName(u.name); })
        .catch(() => {});
    }
  }, [lock?.holderUserId, someoneElseHoldsLock]);

  async function takeover() {
    await fetch(`/api/pages/${pageId}/lock/acquire`, { method: 'POST' });
    window.location.reload();
  }

  const readOnly = previewing || !canEdit || someoneElseHoldsLock;

  return (
    <div className="relative h-screen bg-background">
      <EditorChrome
        pageId={pageId}
        title={title}
        canManage={canManage}
        canEdit={canEdit}
        saveStatus={saveStatus}
        commentsOpen={commentsOpen}
        onToggleComments={() => setCommentsOpen(o => !o)}
      />

      {someoneElseHoldsLock && lock?.expiresAt && (
        <LockBanner holderName={holderName} expiresAt={lock.expiresAt} onTakeover={takeover} />
      )}

      {previewing && (
        <div className="absolute top-12 left-0 right-0 z-10 px-4 py-2 bg-primary/10 border-b border-primary/20 backdrop-blur-md text-sm flex items-center justify-between">
          <span>Previewing a previous version (read-only).</span>
          <a href={`/pages/${pageId}`} className="text-sm font-medium text-primary hover:underline">
            Exit preview
          </a>
        </div>
      )}

      <div className="absolute inset-0 pt-12">
        <ExcalidrawCanvas
          pageId={pageId}
          initialScene={initialScene}
          readOnly={readOnly}
          onSaveStatusChange={setSaveStatus}
        />
      </div>

      <CommentsPanel
        pageId={pageId}
        open={commentsOpen}
        canComment={canComment && !previewing}
        currentUserId={currentUserId}
        isOwner={canManage}
        onClose={() => setCommentsOpen(false)}
      />
    </div>
  );
}
