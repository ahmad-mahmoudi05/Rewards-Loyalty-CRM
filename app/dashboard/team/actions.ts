"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { InviteStaffSchema } from "@/lib/validation/team";
import { sendEmail } from "@/services/messaging/email";
import { escapeHtml } from "@/services/messaging/email-template";
import { getSiteUrl } from "@/lib/site-url";
import { getEntitlements, usageLimitMessage } from "@/lib/entitlements";

export type InviteStaffState = { error?: string; success?: boolean; email?: string } | undefined;

/**
 * Real invite-then-accept flow (Day 4): business_id and role are fixed on
 * the business_invitations row and never taken from the client again at
 * acceptance time (see accept_business_invitation RPC, migration 0018) —
 * that's what makes role/business escalation through a modified URL
 * impossible. Superseded Day 3's "create the account + show a password
 * once" MVP now that real email exists to deliver an actual invite link.
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
  const { email, role } = parsed.data;

  const { data: existingMember } = await service
    .from("business_members")
    .select("id, profile:profiles!business_members_profile_id_fkey(email)")
    .eq("business_id", membership.business_id);
  if (existingMember?.some((m) => m.profile?.email === email)) {
    return { error: "This person is already part of your team." };
  }

  // Entitlement enforcement (Day 5): counts *current members + pending
  // invitations* against the plan's max_staff, not just accepted members —
  // otherwise an owner could invite past the limit while several
  // invitations sit unaccepted. Rejected server-side, not just a hidden
  // "invite" button.
  const entitlements = await getEntitlements(membership.business_id);
  const { count: pendingInvites } = await service
    .from("business_invitations")
    .select("id", { count: "exact", head: true })
    .eq("business_id", membership.business_id)
    .is("accepted_at", null);
  const currentSeats = (existingMember?.length ?? 0) + (pendingInvites ?? 0);
  const limitMessage = usageLimitMessage({
    current: currentSeats,
    limit: entitlements.maxStaff,
    resource: "team members",
    planName: entitlements.planName,
  });
  if (limitMessage) return { error: limitMessage };

  const { data: invitation, error: inviteError } = await service
    .from("business_invitations")
    .insert({ business_id: membership.business_id, email, role, invited_by: membership.profile_id })
    .select("token")
    .single();

  if (inviteError || !invitation) {
    return { error: "Could not create this invitation. Please try again." };
  }

  const siteUrl = await getSiteUrl();
  const inviteUrl = `${siteUrl}/invite/${invitation.token}`;
  // business.name is owner-controlled input, not attacker-controlled by the
  // invitee — but it still reaches another person's inbox as raw HTML, so
  // it's escaped the same way every other outbound email template already
  // does (see services/messaging/email-template.ts), rather than being the
  // one hand-rolled email in the codebase that skips it.
  const safeBusinessName = escapeHtml(membership.business.name);

  const result = await sendEmail({
    to: email,
    subject: `You've been invited to join ${membership.business.name} on LoyalNest`,
    html: `<p>You've been invited to join <strong>${safeBusinessName}</strong> on LoyalNest as ${role === "MANAGER" ? "a manager" : "staff"}.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
    text: `You've been invited to join ${membership.business.name} on LoyalNest as ${role === "MANAGER" ? "a manager" : "staff"}.\n\nAccept: ${inviteUrl}\n\nThis link expires in 7 days.`,
    fromName: "LoyalNest",
    idempotencyKey: `invite-${invitation.token}`,
  });

  if (!result.success) {
    return { error: `Invitation created but the email could not be sent: ${result.error}` };
  }

  revalidatePath("/dashboard/team");
  return { success: true, email };
}

export type RevokeInvitationState = { error?: string; success?: boolean } | undefined;

/**
 * Uses the business_invitations_delete_owner_or_manager RLS policy added
 * this revision (migration 0025) — before it existed, a sent invitation
 * token stayed valid for the full 7-day window with no way to cut it off.
 */
export async function revokeInvitation(_state: RevokeInvitationState, formData: FormData): Promise<RevokeInvitationState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string" || !invitationId) {
    return { error: "Invalid invitation." };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("business_invitations")
    .delete({ count: "exact" })
    .eq("id", invitationId)
    .eq("business_id", membership.business_id);

  if (error || !count) {
    return { error: "Could not revoke this invitation." };
  }

  revalidatePath("/dashboard/team");
  return { success: true };
}
