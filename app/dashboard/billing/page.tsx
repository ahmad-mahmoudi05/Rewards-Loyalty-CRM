import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { isStripeConfigured } from "@/services/billing/stripe";
import { CheckoutButton, ManageBillingButton } from "./billing-buttons";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  TRIALING: "bg-blue-100 text-blue-800",
  PAST_DUE: "bg-yellow-100 text-yellow-800",
  UNPAID: "bg-red-100 text-red-800",
  CANCELLED: "bg-foreground/10 text-foreground/50",
  INCOMPLETE: "bg-foreground/10 text-foreground/50",
  INCOMPLETE_EXPIRED: "bg-red-100 text-red-800",
  PAUSED: "bg-foreground/10 text-foreground/50",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const membership = await requireRole(["OWNER"]);
  const { checkout } = await searchParams;
  const supabase = await createClient();

  const [entitlements, { data: plans }, { data: subscription }] = await Promise.all([
    getEntitlements(membership.business_id),
    supabase.from("plans").select("*").order("price_monthly", { ascending: true }),
    supabase.from("subscriptions").select("stripe_customer_id").eq("business_id", membership.business_id).maybeSingle(),
  ]);

  const stripeConfigured = isStripeConfigured();
  const hasStripeCustomer = Boolean(subscription?.stripe_customer_id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-foreground/70">Your plan, usage, and payment method. Owner only.</p>
      </div>

      {checkout === "success" && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Checkout complete. It can take a few seconds for your plan to update below.
        </p>
      )}
      {checkout === "cancelled" && (
        <p className="rounded-md bg-foreground/5 px-3 py-2 text-sm text-foreground/70">Checkout was cancelled.</p>
      )}

      {!stripeConfigured && (
        <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          Stripe isn&apos;t connected on this deployment yet — plan changes below won&apos;t work until
          <code className="mx-1">STRIPE_SECRET_KEY</code>/<code>STRIPE_WEBHOOK_SECRET</code> are set. See
          docs/integrations.md.
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium">{entitlements.planName}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[entitlements.status] ?? STATUS_STYLES.INCOMPLETE}`}>
            {entitlements.status}
          </span>
        </div>

        {entitlements.isTrialing && entitlements.trialDaysRemaining !== null && (
          <p className="text-sm text-foreground/70">
            {entitlements.trialDaysRemaining > 0
              ? `Trial ends in ${entitlements.trialDaysRemaining} day${entitlements.trialDaysRemaining === 1 ? "" : "s"}.`
              : "Your trial has ended."}
          </p>
        )}
        {entitlements.currentPeriodEnd && (
          <p className="text-sm text-foreground/70">
            {entitlements.cancelAtPeriodEnd ? "Cancels" : "Renews"} on{" "}
            {new Date(entitlements.currentPeriodEnd).toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })}.
          </p>
        )}

        {hasStripeCustomer && stripeConfigured && <ManageBillingButton />}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Plans</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans?.map((plan) => {
            const isCurrent = plan.code === entitlements.planCode;
            return (
              <div key={plan.id} className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-5">
                <div>
                  <h3 className="text-base font-medium">{plan.name}</h3>
                  <p className="text-2xl font-semibold">
                    {plan.currency} {plan.price_monthly}
                    <span className="text-sm font-normal text-foreground/60">/mo</span>
                  </p>
                </div>
                <ul className="flex flex-col gap-1 text-sm text-foreground/70">
                  <li>{plan.max_locations} location{plan.max_locations === 1 ? "" : "s"}</li>
                  <li>Up to {plan.max_staff} staff</li>
                  <li>Up to {plan.max_customers.toLocaleString()} customers</li>
                  <li>{plan.whatsapp_enabled ? "WhatsApp + " : ""}{plan.sms_enabled ? "SMS + " : ""}Email campaigns</li>
                  <li>{plan.automation_enabled ? "Automations included" : "No automations"}</li>
                  {plan.advanced_analytics && <li>Advanced analytics</li>}
                  {plan.white_label_enabled && <li>White-label</li>}
                </ul>
                {isCurrent ? (
                  <span className="mt-auto rounded-full bg-foreground/10 px-4 py-2 text-center text-sm font-medium text-foreground/60">
                    Current plan
                  </span>
                ) : stripeConfigured ? (
                  <CheckoutButton planCode={plan.code} label={entitlements.planCode === "NONE" ? "Choose plan" : "Switch plan"} />
                ) : (
                  <span className="mt-auto rounded-full border border-foreground/15 px-4 py-2 text-center text-sm text-foreground/40">
                    Unavailable
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
