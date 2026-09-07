import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, mapStripeStatus } from "@/services/billing/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Stripe billing webhook (Day 5). Same shape as the Meta/Twilio/Resend
 * webhooks: verify the signature over the raw body first, record the event
 * idempotently before doing anything else, then apply state — Stripe is the
 * source of truth for subscription state, never the browser's return from
 * Checkout (see services/billing/stripe.ts and docs/database.md).
 *
 * Untested against a real Stripe account (none configured in this
 * environment — no keys were provided this session, see
 * docs/integrations.md); exercised with correctly-signed synthetic events
 * built with Stripe's own `stripe.webhooks.generateTestHeaderString` helper
 * (the same tool Stripe's own docs recommend for testing signature
 * verification without a live account), the same honesty standard already
 * applied to every other provider webhook in this codebase.
 */

type SupabaseServiceClient = ReturnType<typeof createServiceRoleClient>;

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 501 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { error: insertError } = await supabase.from("stripe_webhook_events").insert({ id: event.id, type: event.type });
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw insertError;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.client_reference_id ?? (session.metadata?.business_id as string | undefined);
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (businessId && customerId) {
        await supabase.from("subscriptions").update({ stripe_customer_id: customerId }).eq("business_id", businessId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await syncSubscription(supabase, event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      await syncSubscription(supabase, event.data.object as Stripe.Subscription, "CANCELLED");
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed":
      // Recorded above (stripe_webhook_events) for observability. The
      // authoritative state change for both ("payment recovered" /
      // "payment failed") always arrives as its own
      // customer.subscription.updated event (status flips to active/
      // past_due) — applying it a second time here risks two events racing
      // to write the same fields from slightly different snapshots.
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

/**
 * Resolves which business this Stripe subscription belongs to — preferring
 * the metadata set at Checkout creation (subscription_data.metadata.business_id,
 * services/billing/stripe.ts), then falling back to matching an existing
 * `stripe_subscription_id`/`stripe_customer_id` already on file (covers a
 * portal-initiated change where Stripe's copy of the metadata could
 * theoretically be stale). If none of these resolve to a known business,
 * the event is acknowledged and dropped — never guessed.
 */
async function resolveLocalSubscription(supabase: SupabaseServiceClient, subscription: Stripe.Subscription, customerId: string) {
  const businessId = subscription.metadata?.business_id;
  if (businessId) {
    const { data } = await supabase.from("subscriptions").select("id, plan_id").eq("business_id", businessId).maybeSingle();
    if (data) return data;
  }

  const { data: bySubscriptionId } = await supabase.from("subscriptions").select("id, plan_id").eq("stripe_subscription_id", subscription.id).maybeSingle();
  if (bySubscriptionId) return bySubscriptionId;

  const { data: byCustomerId } = await supabase.from("subscriptions").select("id, plan_id").eq("stripe_customer_id", customerId).maybeSingle();
  return byCustomerId ?? null;
}

async function syncSubscription(supabase: SupabaseServiceClient, subscription: Stripe.Subscription, forceStatus?: string) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const existing = await resolveLocalSubscription(supabase, subscription, customerId);
  if (!existing) return; // no local business resolved — nothing to update, never guessed

  // API versions from mid-2025 onward moved billing-cycle dates off the
  // Subscription object onto its items — see node_modules/stripe's own
  // Subscriptions.d.ts (no current_period_end on Subscription) vs
  // SubscriptionItems.d.ts (current_period_end IS there). Verified directly
  // against the installed SDK's types rather than assumed from training data.
  const item = subscription.items.data[0];

  let planId = existing.plan_id;
  if (item?.price?.id) {
    const { data: plan } = await supabase.from("plans").select("id").eq("stripe_price_id", item.price.id).maybeSingle();
    if (plan) planId = plan.id;
  }

  await supabase
    .from("subscriptions")
    .update({
      plan_id: planId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: forceStatus ?? mapStripeStatus(subscription.status),
      current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq("id", existing.id);
}
