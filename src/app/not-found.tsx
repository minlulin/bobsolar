import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center text-center px-4">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/5 border border-white/10">
        <FileQuestion className="h-12 w-12 text-muted-foreground" />
      </div>
      <h2 className="mb-2 text-3xl font-bold tracking-tight text-white">Page not found</h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        We couldn't find the page you're looking for. It might have been moved or deleted.
      </p>
      <Button asChild className="bg-white text-black hover:bg-white/90 font-medium">
        <Link href="/">Return to Dashboard</Link>
      </Button>
    </div>
  );
}
