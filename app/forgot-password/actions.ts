"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ForgotPasswordSchema } from "@/lib/validation/auth";
import { getSiteUrl } from "@/lib/site-url";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type ForgotPasswordState = { error?: string; success?: boolean } | undefined;

/**
 * Always returns the same success state whether or not the email belongs to
 * a real account — Supabase's own `resetPasswordForEmail` already doesn't
 * error on an unknown address, and this action doesn't add a branch that
 * would (no account-enumeration signal in the response either way).
 */
export async function requestPasswordReset(_state: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const parsed = ForgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  const ip = getClientIp(await headers());
  if (!checkRateLimit("forgot-password", ip, 5, 60 * 60_000).allowed) {
    // Same generic success shape even when rate-limited — no signal either
    // way about whether the address exists or how many attempts remain.
    return { success: true };
  }

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  // The actual link the user clicks is built by supabase/templates/recovery.html
  // (token_hash + type, pointed at app/auth/confirm/route.ts) — redirectTo
  // here only needs to satisfy Supabase's allow-list check.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  return { success: true };
}
