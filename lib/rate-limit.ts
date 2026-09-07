import "server-only";

/**
 * Deliberately simple (spec: "do not overengineer"): a fixed-window
 * in-memory counter per (bucket, key). Good enough to blunt casual
 * scripted abuse of public endpoints (signup, login, invite acceptance,
 * unsubscribe, QR resolution) — not a substitute for a real distributed
 * limiter (Upstash/Redis) at meaningful production scale.
 *
 * Known, accepted limitation: state is per server-process/instance, so a
 * multi-instance Vercel deployment gives each instance its own independent
 * budget rather than one shared one. Real webhook endpoints (Meta/Twilio/
 * Stripe/Resend) intentionally do NOT use this — signature verification is
 * the correct control there, not a rate limit (see docs/architecture.md).
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

// Prevents unbounded growth from many distinct IPs over a long-running process.
const MAX_TRACKED_KEYS = 50_000;

export function checkRateLimit(bucket: string, key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const compositeKey = `${bucket}:${key}`;
  const now = Date.now();
  const existing = buckets.get(compositeKey);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
    buckets.set(compositeKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Best-effort client IP from standard proxy headers (Vercel sets x-forwarded-for). Falls back to a shared bucket if unavailable — never throws. */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
