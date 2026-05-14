'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

type Folder = { id: string; name: string; parentFolderId: string | null };

function group(folders: Folder[]) {
  const m = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const k = f.parentFolderId ?? null;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(f);
  }
  return m;
}

function Node({
  folder,
  byParent,
  depth,
}: {
  folder: Folder;
  byParent: Map<string | null, Folder[]>;
  depth: number;
}) {
  const kids = byParent.get(folder.id) ?? [];
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  const active = pathname === `/folders/${folder.id}`;
  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md hover:bg-secondary ${active ? 'bg-secondary' : ''}`}
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        {kids.length > 0 ? (
          <button
            onClick={() => setOpen(!open)}
            className="h-6 w-6 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              className={`transition-transform ${open ? 'rotate-90' : ''}`}
            >
              <path
                d="M4 2l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <span className="h-6 w-6 inline-block" aria-hidden />
        )}
        <Link href={`/folders/${folder.id}`} className="flex-1 truncate text-sm py-1 pr-2">
          {folder.name}
        </Link>
      </div>
      {open && kids.length > 0 && (
        <ul>
          {kids.map(k => (
            <Node key={k.id} folder={k} byParent={byParent} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FolderTree({ folders }: { folders: Folder[] }) {
  const byParent = group(folders);
  const roots = byParent.get(null) ?? [];
  if (roots.length === 0) {
    return <p className="text-xs text-muted-foreground px-2">No folders yet.</p>;
  }
  return (
    <ul className="space-y-0.5">
      {roots.map(r => (
        <Node key={r.id} folder={r} byParent={byParent} depth={0} />
      ))}
    </ul>
  );
}
