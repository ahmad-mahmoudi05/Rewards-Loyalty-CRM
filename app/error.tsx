"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Catches any uncaught error in the App Router tree below the root layout.
 * Production must never show a raw stack trace to a real business owner —
 * Next.js already strips error details from the client bundle in
 * production builds; this is the friendly page shown in their place. Logs
 * via `console.error` (Vercel captures this to its own function logs) —
 * see docs/architecture.md "Observability" for what's wired vs deferred.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled application error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-foreground/70">
        We hit an unexpected error. Nothing was lost — try again, or head back to your
        dashboard.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <Link href="/dashboard" className="rounded-full border border-foreground/15 px-5 py-2.5 text-sm font-medium hover:bg-foreground/5">
          Go to dashboard
        </Link>
      </div>
      {error.digest && <p className="text-xs text-foreground/40">Reference: {error.digest}</p>}
    </main>
  );
}
