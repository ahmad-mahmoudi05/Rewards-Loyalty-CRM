import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Handles every Supabase email-link verification (password recovery here,
 * Day 5; email confirmation once `enable_confirmations` is turned back on
 * for production — see docs/database.md "Auth production configuration").
 * `token_hash`+`type` is Supabase's current documented App Router pattern
 * (`supabase.auth.verifyOtp`) — the email templates in the Supabase
 * dashboard must point their action link at
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=...`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    // No account-enumeration signal either way — same generic message
    // regardless of whether the link was tampered with, already used, or
    // genuinely expired.
    const destination = type === "recovery" ? "/forgot-password" : "/login";
    return NextResponse.redirect(new URL(`${destination}?error=link_expired`, request.url));
  }

  const destination = type === "recovery" ? "/reset-password" : next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(new URL(destination, request.url));
}
