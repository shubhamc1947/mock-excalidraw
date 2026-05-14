import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { FolderTree } from '@/components/folders/folder-tree';
import { NewFolderDialog } from '@/components/folders/new-folder-dialog';
import Link from 'next/link';

export async function Sidebar() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return null;
  const folders = await db.folder.findMany({
    where: { ownerId: userId, deletedAt: { isSet: false } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, parentFolderId: true },
  });
  return (
    <div className="w-full p-4 space-y-6 overflow-y-auto">
      <nav className="space-y-1">
        <Link
          href="/"
          className="block px-2 py-1.5 text-sm rounded-md hover:bg-secondary text-foreground"
        >
          Home
        </Link>
        <Link
          href="/shared"
          className="block px-2 py-1.5 text-sm rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
        >
          Shared with me
        </Link>
        <Link
          href="/trash"
          className="block px-2 py-1.5 text-sm rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
        >
          Trash
        </Link>
      </nav>

      <div>
        <div className="flex items-center justify-between mb-2 px-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Folders
          </h3>
          <NewFolderDialog parentFolderId={null} />
        </div>
        <FolderTree folders={folders} />
      </div>
    </div>
  );
}
