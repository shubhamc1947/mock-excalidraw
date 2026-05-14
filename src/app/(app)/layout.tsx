import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TopNav } from '@/components/navigation/top-nav';
import { Sidebar } from '@/components/navigation/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const user = session.user as { id: string; email: string; name: string | null; image: string | null };
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav user={user} />
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex md:w-[260px] lg:w-[280px] border-r border-border/60 bg-card/30">
          <Sidebar />
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 md:px-10 py-10 md:py-14">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
