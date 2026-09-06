"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { InviteStaffSchema } from "@/lib/validation/team";

export type InviteStaffState =
  | { error?: string; success?: boolean; tempPassword?: string; email?: string }
  | undefined;

function randomTempPassword() {
  return `Lp-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * MVP staff invitation (Part 17): no email-sending infrastructure exists
 * yet (that's Day 4's Resend integration), so a brand-new staff member's
 * temporary password is shown once to the inviting owner/manager to relay
 * manually. Assigning an EXISTING LoyalNest user (by email) to this
 * business is also supported and doesn't touch their password.
 *
 * Role is restricted to STAFF/MANAGER at the schema level (zod enum) —
 * OWNER is never an option here. See docs/database.md for the DB-level
 * backstop (business_members_guard_owner_role trigger, migration 0014).
 */
export async function inviteStaffMember(_state: InviteStaffState, formData: FormData): Promise<InviteStaffState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);

  const parsed = InviteStaffSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form for errors." };
  }

  const service = createServiceRoleClient();
  const { email, fullName, role } = parsed.data;

  const { data: existingProfile } = await service.from("profiles").select("id").eq("email", email).maybeSingle();

  let profileId: string;
  let tempPassword: string | undefined;

  if (existingProfile) {
    profileId = existingProfile.id;
  } else {
    tempPassword = randomTempPassword();
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) {
      return { error: "Could not create an account for this email. It may already be in use." };
    }
    profileId = created.user.id;
  }

  const { error: memberError } = await service.from("business_members").insert({
    business_id: membership.business_id,
    profile_id: profileId,
    role,
    invited_by: membership.profile_id,
  });

  if (memberError) {
    if (memberError.code === "23505") {
      return { error: "This person is already part of your team." };
    }
    return { error: "Could not add this team member. Please try again." };
  }

  revalidatePath("/dashboard/team");
  return { success: true, tempPassword, email };
}
