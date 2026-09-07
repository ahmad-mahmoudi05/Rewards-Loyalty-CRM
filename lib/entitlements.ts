import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

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
 * flag from them. Safe to call with either an authenticated (RLS-scoped) or
 * service-role client — `subscriptions_select_owner` (Day 1 RLS) already
 * restricts the authenticated path to the business's own OWNER, which is
 * who calls this from server actions; the service-role callers (webhook,
 * scheduled evaluators) intentionally bypass that, same as everywhere else
 * service-role is used in this codebase.
 *
 * A business with no subscription row at all (shouldn't happen after this
 * session — onboarding always creates one — but defensively handled for any
 * business created before this migration, or a race) is treated as
 * `isTrialExpired: true` / `isInGoodStanding: false` with the most
 * restrictive fallback limits, never as unlimited access.
 */
export async function getEntitlements(supabase: SupabaseClient<Database>, businessId: string): Promise<Entitlements> {
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
}

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
