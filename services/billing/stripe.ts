import "server-only";
import Stripe from "stripe";

/**
 * Stripe SaaS billing (Day 5). CODE COMPLETE / no live keys in this
 * environment — see docs/integrations.md. Gated exactly like every other
 * provider in this codebase: `getStripeClient()` returns null with no
 * `STRIPE_SECRET_KEY`, and every call site turns that into a clear "billing
 * isn't configured yet" message rather than a raw crash.
 */

let cachedClient: Stripe | null | undefined;

export function getStripeClient(): Stripe | null {
  if (cachedClient !== undefined) return cachedClient;
  const key = process.env.STRIPE_SECRET_KEY;
  cachedClient = key ? new Stripe(key) : null;
  return cachedClient;
}

export function isStripeConfigured(): boolean {
  return getStripeClient() !== null;
}

/**
 * Stripe's real subscription statuses, mapped to this schema's widened
 * check constraint (migration 0024). One named mapping, not scattered
 * string comparisons — the webhook route and any future call site both go
 * through this.
 */
export function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELLED";
    case "incomplete":
      return "INCOMPLETE";
    case "incomplete_expired":
      return "INCOMPLETE_EXPIRED";
    case "unpaid":
      return "UNPAID";
    case "paused":
      return "PAUSED";
    default:
      return "INCOMPLETE";
  }
}

export async function createCheckoutSession(params: {
  stripe: Stripe;
  businessId: string;
  businessName: string;
  ownerEmail: string;
  existingStripeCustomerId: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string } | { error: string }> {
  try {
    const session = await params.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.businessId,
      ...(params.existingStripeCustomerId
        ? { customer: params.existingStripeCustomerId }
        : { customer_email: params.ownerEmail }),
      subscription_data: {
        metadata: { business_id: params.businessId },
      },
      metadata: { business_id: params.businessId },
    });

    if (!session.url) return { error: "Stripe did not return a checkout URL." };
    return { url: session.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not start checkout." };
  }
}

export async function createPortalSession(params: {
  stripe: Stripe;
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<{ url: string } | { error: string }> {
  try {
    const session = await params.stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: params.returnUrl,
    });
    return { url: session.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not open the billing portal." };
  }
}
