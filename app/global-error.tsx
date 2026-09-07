"use client";

/**
 * Catches an error thrown by the root layout itself, where app/error.tsx
 * can't run (it's rendered inside the layout it would need to replace).
 * Must render its own <html>/<body> — there is no layout below this to
 * inherit from. Rare in practice; exists so a root-layout crash never shows
 * Next.js's raw default error screen in production.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "1.5rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", color: "#666" }}>Please try again.</p>
          <button
            onClick={reset}
            style={{ borderRadius: "9999px", background: "#111", color: "#fff", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, border: "none", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
