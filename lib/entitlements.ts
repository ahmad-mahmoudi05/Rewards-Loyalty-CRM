import "server-only";
import { cache } from "react";
import type { Database } from "@/lib/supabase/database.types";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * The single place plan/subscription state gets turned into "can this
 * business do X" — every other file (UI or server action) should read from
 * here, never check `plan.code === 'PRO'` or a raw `subscriptions.status`
 * directly. See docs/database.md for the full plan/subscription schema
 * (unchanged from Day 1 — this is a read layer over it, not a new model).
 */

export type SubscriptionStatus = Database["public"]["Tables"]["subscriptions"]["Row"]["status"];

export type Entitlements = {
  planCode: string;
  planName: string;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
  /** Trial expired without ever converting — the specific "billing gate" state. */
  isTrialExpired: boolean;
  /** True for TRIALING (not expired) or ACTIVE — the general "may use the product" state. */
  isInGoodStanding: boolean;
  maxLocations: number;
  maxStaff: number;
  maxCustomers: number;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  automationEnabled: boolean;
  whiteLabelEnabled: boolean;
  customDomainEnabled: boolean;
  advancedAnalytics: boolean;
};

const NO_SUBSCRIPTION_FALLBACK: Omit<Entitlements, "planCode" | "planName"> = {
  status: "INCOMPLETE",
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  isTrialing: false,
  trialDaysRemaining: null,
  isTrialExpired: true,
  isInGoodStanding: false,
  maxLocations: 1,
  maxStaff: 1,
  maxCustomers: 0,
  emailEnabled: false,
  whatsappEnabled: false,
  smsEnabled: false,
  automationEnabled: false,
  whiteLabelEnabled: false,
  customDomainEnabled: false,
  advancedAnalytics: false,
};

/**
 * Reads the business's plan + subscription and derives every entitlement
 * flag from them.
 *
 * Deliberately uses a service-role client internally, not whatever client
 * the caller has — `subscriptions_select_owner` RLS restricts SELECT on
 * `subscriptions` to the business's OWNER only (spec section 5: staff must
 * not see billing). That's the correct restriction for the raw table, but
 * entitlements are a business-wide gate that MANAGER/STAFF actions also
 * need to evaluate correctly (e.g. `recordTransaction`, which STAFF are
 * meant to be able to do) — calling this with an authenticated non-OWNER
 * client silently got `null` back from RLS and fell through to
 * `NO_SUBSCRIPTION_FALLBACK`, which blocks the action outright regardless
 * of the real subscription state. Found and fixed during the Session 9 UX/
 * performance pass (verified live: a real STAFF session reading
 * `subscriptions` directly got `{data: null, error: null}` for a business
 * with a genuinely active TRIALING subscription). `businessId` is always
 * supplied by a caller that has already established, through an
 * RLS-validated membership lookup, that the current session belongs to
 * that business — this never accepts an arbitrary caller-chosen id, so
 * reading it with elevated privilege here doesn't create a cross-tenant
 * path, matching how service-role is already used elsewhere in this
 * codebase for background reads scoped to an already-validated business_id.
 *
 * Wrapped in `cache()` (dropping the old `supabase` parameter is what makes
 * this actually dedupe — `cache()` keys on argument equality, and a fresh
 * client instance per call site would never have matched by reference) so
 * a page that needs entitlements in both its shared layout and its own
 * body — `/dashboard/billing`, `/dashboard/locations` — only pays for one
 * query per request, not two. `cache()` is request-scoped only, never
 * shared across requests or users, so this cannot leak entitlements data
 * between tenants or sessions.
 *
 * A business with no subscription row at all (shouldn't happen — onboarding
 * always creates one — but defensively handled) is treated as
 * `isTrialExpired: true` / `isInGoodStanding: false` with the most
 * restrictive fallback limits, never as unlimited access.
 */
export const getEntitlements = cache(async (businessId: string): Promise<Entitlements> => {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("*, plan:plans(*)")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!data || !data.plan) {
    return { planCode: "NONE", planName: "No plan", ...NO_SUBSCRIPTION_FALLBACK };
  }

  const plan = data.plan;
  const now = Date.now();
  const trialEndsAtMs = data.trial_ends_at ? new Date(data.trial_ends_at).getTime() : null;
  const isTrialing = data.status === "TRIALING";
  const trialExpiredByDate = isTrialing && trialEndsAtMs !== null && trialEndsAtMs < now;
  const trialDaysRemaining = isTrialing && trialEndsAtMs !== null ? Math.max(0, Math.ceil((trialEndsAtMs - now) / 86400000)) : null;

  const isTrialExpired = trialExpiredByDate || data.status === "INCOMPLETE_EXPIRED" || data.status === "UNPAID" || data.status === "CANCELLED" || data.status === "PAST_DUE";
  const isInGoodStanding = (isTrialing && !trialExpiredByDate) || data.status === "ACTIVE";

  return {
    planCode: plan.code,
    planName: plan.name,
    status: data.status,
    trialEndsAt: data.trial_ends_at,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    isTrialing,
    trialDaysRemaining,
    isTrialExpired,
    isInGoodStanding,
    maxLocations: plan.max_locations,
    maxStaff: plan.max_staff,
    maxCustomers: plan.max_customers,
    emailEnabled: plan.email_enabled,
    whatsappEnabled: plan.whatsapp_enabled,
    smsEnabled: plan.sms_enabled,
    automationEnabled: plan.automation_enabled,
    whiteLabelEnabled: plan.white_label_enabled,
    customDomainEnabled: plan.custom_domain_enabled,
    advancedAnalytics: plan.advanced_analytics,
  };
});

/**
 * The standard "reject the action, don't just hide the button" gate for
 * business-action server actions (recording a transaction, sending a
 * campaign, ...). Returns a user-facing message, never throws — callers
 * return it the same way they return any other validation error.
 */
export function billingGateMessage(entitlements: Entitlements): string | null {
  if (entitlements.isTrialExpired) {
    return "Your trial has ended. Upgrade your plan in Billing to continue.";
  }
  if (!entitlements.isInGoodStanding) {
    return "Your subscription needs attention. Check Billing to continue.";
  }
  return null;
}

/** `current > limit` framing (not `>=`) since `limit` is an inclusive cap. */
export function usageLimitMessage(params: { current: number; limit: number; resource: string; planName: string }): string | null {
  if (params.current >= params.limit) {
    return `Your ${params.planName} plan allows up to ${params.limit} ${params.resource}. Upgrade in Billing to add more.`;
  }
  return null;
}
