"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type AcceptInviteState = { error?: string } | undefined;

async function loadValidInvitation(token: string) {
  if (!z.uuid().safeParse(token).success) return null;
  const service = createServiceRoleClient();
  const { data: invitation } = await service
    .from("business_invitations")
    .select("*, business:businesses(name)")
    .eq("token", token)
    .maybeSingle();
  if (!invitation || invitation.accepted_at || new Date(invitation.expires_at) < new Date()) return null;
  return invitation;
}

/** For a user who is already logged in with a matching email. */
export async function acceptInvitation(token: string): Promise<AcceptInviteState> {
  const invitation = await loadValidInvitation(token);
  if (!invitation) return { error: "This invitation is invalid or has expired." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== invitation.email) {
    return { error: "Log in with the invited email address to accept this invitation." };
  }

  const { error } = await supabase.rpc("accept_business_invitation", { p_token: token });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

/** For a brand-new person with no LoyalNest account yet. */
export async function signUpAndAcceptInvite(
  token: string,
  _state: AcceptInviteState,
  formData: FormData
): Promise<AcceptInviteState> {
  const ip = getClientIp(await headers());
  if (!checkRateLimit("invite-signup", ip, 10, 60 * 60_000).allowed) {
    return { error: "Too many attempts. Please try again later." };
  }

  const invitation = await loadValidInvitation(token);
  if (!invitation) return { error: "This invitation is invalid or has expired." };

  const fullName = formData.get("fullName");
  const password = formData.get("password");
  if (typeof fullName !== "string" || fullName.trim().length < 2) {
    return { error: "Enter your full name." };
  }
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error: signUpError } = await supabase.auth.signUp({
    email: invitation.email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (signUpError) return { error: signUpError.message };

  const { error: acceptError } = await supabase.rpc("accept_business_invitation", { p_token: token });
  if (acceptError) return { error: acceptError.message };

  redirect("/dashboard");
}
