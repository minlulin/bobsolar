import Link from "next/link";
import type * as React from "react";

export default function UnauthorizedPage(): React.JSX.Element {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-20">
      <section className="border-border bg-card w-full max-w-lg rounded-2xl border p-8 text-center">
        <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Access Denied</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unauthorized</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Your account is authenticated, but it does not have permission to view this area.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="bg-solar rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="border-border rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted/60"
          >
            Switch Account
          </Link>
        </div>
      </section>
    </main>
  );
}
