/**
 * Guards against open redirects. A bare `.startsWith("/")` check (used at
 * three call sites before this revision: login, the login page's initial
 * redirect param, and /auth/confirm's `next` param) still lets through
 * `//evil.com/x` — browsers resolve a leading `//` as a protocol-relative
 * URL to a different host, not a path on the current one. Also reject a
 * backslash-prefixed value (`/\evil.com`), which some browsers normalize
 * the same way.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
