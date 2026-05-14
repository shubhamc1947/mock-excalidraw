import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-glow" aria-hidden />
      <header className="absolute top-0 right-0 p-6 z-10">
        <ThemeToggle />
      </header>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M4.93 4.93l14.14 14.14" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              This link is no longer available
            </h1>
            <p className="text-sm text-muted-foreground">
              The page may have been made private or deleted.
            </p>
          </div>
          <Button render={<Link href="/" />}>Go home</Button>
        </div>
      </div>
    </main>
  );
}
