import { signIn, auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-2xl bg-card">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Continue with Google to access your drawings.
          </p>
        </div>
        <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }); }}>
          <Button type="submit" className="w-full" size="lg">
            Continue with Google
          </Button>
        </form>
      </div>
    </main>
  );
}
