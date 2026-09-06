import "server-only";
import { headers } from "next/headers";

/**
 * Resolves the public base URL for building absolute links (the customer
 * signup QR, etc.). Prefers NEXT_PUBLIC_APP_URL (set this in production —
 * see .env.example) and falls back to the incoming request's own host so
 * local dev and preview deployments work without configuration.
 */
export async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") || host?.includes("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
