import Link from 'next/link';
import { FolderActionsMenu } from './folder-actions-menu';

export function FolderCard({ id, name }: { id: string; name: string }) {
  return (
    <div className="group relative">
      <Link
        href={`/folders/${id}`}
        className="block rounded-2xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-[0_0_0_4px_var(--color-primary)/8] hover:-translate-y-0.5"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
            </svg>
          </div>
        </div>
        <div className="font-medium truncate">{name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">Folder</div>
      </Link>
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <FolderActionsMenu folderId={id} currentName={name} />
      </div>
    </div>
  );
}
