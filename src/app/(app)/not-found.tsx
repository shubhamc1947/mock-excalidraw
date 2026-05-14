import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center space-y-4 max-w-md mx-auto">
      <h2 className="text-xl font-semibold">Not found</h2>
      <p className="text-sm text-muted-foreground">
        This page does not exist or you do not have access.
      </p>
      <Button render={<Link href="/" />}>Back to home</Button>
    </div>
  );
}
