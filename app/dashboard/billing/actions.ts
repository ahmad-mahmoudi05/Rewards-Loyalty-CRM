"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, createCheckoutSession, createPortalSession } from "@/services/billing/stripe";
import { getSiteUrl } from "@/lib/site-url";

export type BillingActionState = { error?: string } | undefined;

/**
 * Owner-only (billing is never a MANAGER/STAFF surface — see docs/database.md
 * spec §5). Redirects straight to Stripe's own hosted Checkout/Portal page;
 * the actual subscription state change only ever happens later, via the
 * webhook (app/api/webhooks/stripe/route.ts) — never trusted from this
 * request/response cycle itself.
 */
export async function startCheckout(planCode: string): Promise<BillingActionState> {
  const membership = await requireRole(["OWNER"]);
  const stripe = getStripeClient();
  if (!stripe) {
    return { error: "Billing isn't configured yet. See docs/integrations.md." };
  }

  const supabase = await createClient();

  const [{ data: plan }, { data: subscription }, { data: userRes }] = await Promise.all([
    supabase.from("plans").select("*").eq("code", planCode).maybeSingle(),
    supabase.from("subscriptions").select("stripe_customer_id").eq("business_id", membership.business_id).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!plan) return { error: "Unknown plan." };
  if (!plan.stripe_price_id) {
    return { error: `${plan.name} isn't connected to a Stripe price yet. See docs/integrations.md.` };
  }
  const ownerEmail = userRes.user?.email;
  if (!ownerEmail) return { error: "Could not determine your account email." };

  const siteUrl = await getSiteUrl();
  const result = await createCheckoutSession({
    stripe,
    businessId: membership.business_id,
    businessName: membership.business.name,
    ownerEmail,
    existingStripeCustomerId: subscription?.stripe_customer_id ?? null,
    priceId: plan.stripe_price_id,
    successUrl: `${siteUrl}/dashboard/billing?checkout=success`,
    cancelUrl: `${siteUrl}/dashboard/billing?checkout=cancelled`,
  });

  if ("error" in result) return { error: result.error };
  redirect(result.url);
}

export async function openBillingPortal(): Promise<BillingActionState> {
  const membership = await requireRole(["OWNER"]);
  const stripe = getStripeClient();
  if (!stripe) {
    return { error: "Billing isn't configured yet. See docs/integrations.md." };
  }

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("business_id", membership.business_id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return { error: "You don't have a billing account yet — choose a plan first." };
  }

  const siteUrl = await getSiteUrl();
  const result = await createPortalSession({
    stripe,
    stripeCustomerId: subscription.stripe_customer_id,
    returnUrl: `${siteUrl}/dashboard/billing`,
  });

  if ("error" in result) return { error: result.error };
  redirect(result.url);
}
