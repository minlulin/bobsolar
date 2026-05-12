import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <FileQuestion className="text-muted-foreground h-12 w-12" />
      </div>
      <h2 className="mb-2 text-3xl font-bold tracking-tight text-white">
        Page not found
      </h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        We couldn&apos;t find the page you&apos;re looking for. It might have
        been moved or deleted.
      </p>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
