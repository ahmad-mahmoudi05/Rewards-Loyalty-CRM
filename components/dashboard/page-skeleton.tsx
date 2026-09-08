/**
 * Shared route-level loading fallback (Session 9 UX/performance pass).
 * Rendered by each app/dashboard/<section>/loading.tsx — Next.js wraps just that
 * page segment in a Suspense boundary, so the sidebar/layout (already
 * mounted) stays visible and interactive while this shows instantly on
 * click, instead of a frozen previous page until the new one is fully
 * ready. Deliberately small/generic, not a full-screen spinner — a
 * lightweight shape hint, not "loading theater."
 */
export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-40 rounded bg-foreground/10" />
        <div className="h-4 w-64 rounded bg-foreground/10" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-16 rounded-lg border border-foreground/10 bg-foreground/5" />
        <div className="h-16 rounded-lg border border-foreground/10 bg-foreground/5" />
        <div className="h-16 rounded-lg border border-foreground/10 bg-foreground/5" />
      </div>
    </div>
  );
}
