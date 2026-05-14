import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-glow" aria-hidden />
      <header className="absolute top-0 right-0 p-6 z-10"><ThemeToggle /></header>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="text-center space-y-6 max-w-md">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">404</p>
          <h1 className="text-4xl font-semibold tracking-tight">Nothing here</h1>
          <p className="text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist.</p>
          <Button render={<Link href="/">Go home</Link>} />
        </div>
      </div>
    </main>
  );
}
