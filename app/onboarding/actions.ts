"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateBusinessSchema } from "@/lib/validation/onboarding";
import { slugify } from "@/lib/utils";

export type CreateBusinessState = { error?: string } | undefined;

export async function createBusiness(
  _state: CreateBusinessState,
  formData: FormData
): Promise<CreateBusinessState> {
  const parsed = CreateBusinessSchema.safeParse({
    businessName: formData.get("businessName"),
    businessType: formData.get("businessType"),
    country: formData.get("country") || undefined,
    currency: formData.get("currency") || undefined,
    timezone: formData.get("timezone") || undefined,
    locationName: formData.get("locationName"),
    locationAddress: formData.get("locationAddress") || undefined,
    locationPhone: formData.get("locationPhone") || undefined,
    planCode: formData.get("planCode") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Double-submit / retried-request guard: onboarding is a multi-statement
  // sequence (no cross-REST-call transaction available), so a second
  // near-simultaneous submission must not create a second business for the
  // same person. If this user already has a membership by the time this
  // action runs, treat it as already done rather than creating a duplicate.
  const { data: existingMembership } = await supabase
    .from("business_members")
    .select("id")
    .eq("profile_id", user!.id)
    .limit(1)
    .maybeSingle();
  if (existingMembership) {
    redirect("/dashboard");
  }

  const baseSlug = slugify(parsed.data.businessName) || "business";
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  // Deliberately not chaining .select() on this insert: an INSERT ... RETURNING
  // is itself subject to the table's SELECT policy, which here depends on the
  // business_members row that the on_business_created trigger creates as part
  // of this same statement — and that row isn't guaranteed visible in time for
  // RETURNING's policy check. A plain insert (no RETURNING) only needs the
  // INSERT policy's WITH CHECK to pass, which it does. The follow-up SELECT
  // below runs as a separate statement, by which point the trigger has
  // committed and membership is visible.
  const { error: businessError } = await supabase.from("businesses").insert({
    name: parsed.data.businessName,
    slug,
    business_type: parsed.data.businessType,
    owner_profile_id: user.id,
    country: parsed.data.country,
    currency: parsed.data.currency,
    timezone: parsed.data.timezone,
  });

  if (businessError) {
    console.error("[onboarding] businesses insert failed", businessError);
    return { error: "Could not create your business. Please try again." };
  }

  const { data: business, error: fetchError } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .single();

  if (fetchError || !business) {
    console.error("[onboarding] business read-back failed", fetchError);
    return { error: "Could not create your business. Please try again." };
  }

  // No cross-statement transaction is available here (each of these is a
  // separate PostgREST call) — if branding or the first location fails
  // partway through, compensate by deleting the business we just created
  // (cascades to business_branding/business_members/locations/subscriptions)
  // rather than leaving an orphaned, half-created business that
  // getCurrentBusinessMembership would otherwise treat as "already
  // onboarded" and redirect the user straight past, with no way back in to
  // finish setup.
  async function rollbackBusiness() {
    await supabase.from("businesses").delete().eq("id", business!.id);
  }

  const { error: brandingError } = await supabase.from("business_branding").insert({
    business_id: business.id,
  });

  if (brandingError) {
    console.error("[onboarding] business_branding insert failed", brandingError);
    await rollbackBusiness();
    return { error: "Could not finish setting up your business. Please try again." };
  }

  const { error: locationError } = await supabase.from("locations").insert({
    business_id: business.id,
    name: parsed.data.locationName,
    address: parsed.data.locationAddress,
    phone: parsed.data.locationPhone,
    timezone: parsed.data.timezone,
    is_primary: true,
  });

  if (locationError) {
    console.error("[onboarding] locations insert failed", locationError);
    await rollbackBusiness();
    return { error: "Could not finish setting up your business. Please try again." };
  }

  // Every business starts on a 14-day trial of the chosen plan, no payment
  // collected — Stripe Checkout (Billing page) is how a trial converts to a
  // real subscription. Deliberately a plain insert relying on the new
  // subscriptions_insert_owner_once RLS policy (migration 0024), not a
  // service-role bypass: the OWNER business_members row from
  // on_business_created has already committed by this point (this is a
  // separate statement, not chained RETURNING off the businesses insert —
  // see the Day 1 gotcha documented in docs/database.md), so
  // private.business_role(business_id) = 'OWNER' evaluates correctly here.
  //
  // A failure here is deliberately NOT fatal to onboarding (the business/
  // location/branding are real and useful even without a subscription row,
  // and lib/entitlements.ts falls back to the most restrictive state when
  // one is missing) — but it must not be silent. Logged so it's actually
  // visible instead of vanishing, unlike before this revision.
  const { data: plan } = await supabase.from("plans").select("id").eq("code", parsed.data.planCode).single();
  if (plan) {
    const trialEndsAt = new Date(Date.now() + 14 * 86400000).toISOString();
    const { error: subscriptionError } = await supabase.from("subscriptions").insert({
      business_id: business.id,
      plan_id: plan.id,
      status: "TRIALING",
      trial_ends_at: trialEndsAt,
    });
    if (subscriptionError) {
      console.error("[onboarding] trial subscription insert failed", business.id, subscriptionError);
    }
  } else {
    console.error("[onboarding] no plan found for code", parsed.data.planCode, "- business", business.id, "has no subscription");
  }

  redirect("/dashboard");
}
