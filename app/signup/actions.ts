"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SignupSchema } from "@/lib/validation/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type SignupState = { error?: string; message?: string } | undefined;

export async function signup(_state: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ip = getClientIp(await headers());
  if (!checkRateLimit("signup", ip, 8, 60 * 60_000).allowed) {
    return { error: "Too many signup attempts from this network. Please try again later." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) {
    // Generic message, matching the no-enumeration policy already applied
    // to login/forgot-password/auth-confirm — Supabase's own error text for
    // a duplicate email ("User already registered") would otherwise reveal
    // account existence, the one auth entry point that didn't follow suit.
    return { error: "Could not create an account with those details. If you already have one, try logging in instead." };
  }

  if (!data.session) {
    return { message: "Check your email to confirm your account, then log in." };
  }

  redirect("/onboarding");
}
