import Link from 'next/link';
import { PageActionsMenu } from './page-actions-menu';

type Props = {
  id: string;
  title: string;
  thumbnailDataUrl?: string | null;
  isPublic?: boolean;
  updatedAt?: string;
};

export function PageCard({ id, title, thumbnailDataUrl, isPublic, updatedAt }: Props) {
  return (
    <div className="group relative">
      <Link
        href={`/pages/${id}`}
        className="block rounded-2xl border border-border/60 bg-card overflow-hidden transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div className="aspect-[16/10] bg-secondary/40 relative overflow-hidden">
          {thumbnailDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailDataUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 15l5-5 4 4 3-3 6 6"/>
              </svg>
            </div>
          )}
          {isPublic && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/20 backdrop-blur-sm">
              <span className="h-1 w-1 rounded-full bg-primary" /> Public
            </span>
          )}
        </div>
        <div className="p-4">
          <div className="font-medium truncate">{title || 'Untitled'}</div>
          {updatedAt && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Updated {new Date(updatedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </Link>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-background/80 backdrop-blur-sm rounded-md">
          <PageActionsMenu pageId={id} currentTitle={title || 'Untitled'} />
        </div>
      </div>
    </div>
  );
}
