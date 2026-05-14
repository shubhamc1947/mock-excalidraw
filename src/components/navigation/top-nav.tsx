import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { SearchBox } from './search-box';
import { BellMenu } from './bell-menu';
import { UserMenu } from './user-menu';

type Props = {
  user: { id: string; email: string; name: string | null; image: string | null };
};

export function TopNav({ user }: Props) {
  return (
    <header className="sticky top-0 z-30 h-14 flex items-center gap-4 px-4 md:px-6 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight shrink-0">
        <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
        mock excalidraw
      </Link>
      <div className="flex-1 max-w-xl mx-auto">
        <SearchBox />
      </div>
      <div className="flex items-center gap-1">
        <BellMenu />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
