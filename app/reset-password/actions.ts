"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordSchema } from "@/lib/validation/auth";

export type ResetPasswordState = { error?: string } | undefined;

/**
 * Requires an active session — only reachable with one after
 * app/auth/confirm/route.ts verifies a real recovery token_hash (Supabase's
 * verifyOtp establishes a session as a side effect of a valid recovery
 * link). No separate "old password" check: possessing a live recovery
 * session already proves email ownership, the same trust level a "forgot
 * password" flow is meant to establish.
 */
export async function updatePassword(_state: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const parsed = ResetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid password." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/forgot-password?error=link_expired");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: "Could not update your password. Try requesting a new reset link." };
  }

  redirect("/dashboard");
}
