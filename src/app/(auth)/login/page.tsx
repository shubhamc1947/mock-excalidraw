import { signIn, auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { FadeIn } from '@/components/motion/fade-in';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.61z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.99-2.34z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* ambient glow + grain */}
      <div className="pointer-events-none absolute inset-0 bg-glow" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-40" aria-hidden />

      <header className="absolute top-0 right-0 p-6 z-10">
        <ThemeToggle />
      </header>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <FadeIn className="w-full max-w-[420px]">
          <div className="space-y-8">
            <div className="space-y-3 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border bg-card/80 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> mock excalidraw
              </div>
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-balance">
                Draw. Organize.<br />Share.
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                A focused canvas for diagrams, sketches, and ideas — with folders, comments, and turn-based collaboration.
              </p>
            </div>

            <div className="rounded-2xl border bg-card/80 backdrop-blur-sm shadow-sm p-2">
              <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }); }}>
                <Button type="submit" size="lg" variant="ghost"
                  className="w-full justify-center gap-3 h-12 text-base font-medium hover:bg-secondary">
                  <GoogleMark />
                  Continue with Google
                </Button>
              </form>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              By continuing, you agree to use this service responsibly.
            </p>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
