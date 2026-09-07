import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pricing — LoyalNest",
  description: "Simple, transparent pricing for digital loyalty, CRM, and marketing automation. 14-day free trial, no card required.",
};

const FEATURE_ROWS: Array<{ label: string; key: "locations" | "staff" | "customers" | "email" | "whatsapp" | "sms" | "automation" | "analytics" | "white_label" }> = [
  { label: "Locations", key: "locations" },
  { label: "Staff accounts", key: "staff" },
  { label: "Customers", key: "customers" },
  { label: "Email campaigns", key: "email" },
  { label: "WhatsApp campaigns", key: "whatsapp" },
  { label: "SMS campaigns", key: "sms" },
  { label: "Retention automations", key: "automation" },
  { label: "Advanced analytics", key: "analytics" },
  { label: "White-label", key: "white_label" },
];

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase.from("plans").select("*").order("price_monthly", { ascending: true });

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          LoyalNest
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-foreground/70">
          <Link href="/pricing" className="text-foreground">
            Pricing
          </Link>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Log in
          </Link>
        </nav>
      </header>

      <section className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Simple, transparent pricing</h1>
        <p className="max-w-xl text-base text-foreground/70">
          Every plan includes a 14-day free trial — no card required to start. Upgrade, downgrade, or cancel
          anytime.
        </p>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {(plans ?? []).map((plan, i) => (
            <div
              key={plan.id}
              className={`flex flex-col gap-4 rounded-xl border p-6 ${
                i === 1 ? "border-foreground shadow-sm" : "border-foreground/10"
              }`}
            >
              {i === 1 && (
                <span className="w-fit rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
                  Most popular
                </span>
              )}
              <div>
                <h2 className="text-lg font-medium">{plan.name}</h2>
                <p className="mt-2 text-3xl font-semibold">
                  {plan.currency} {plan.price_monthly}
                  <span className="text-base font-normal text-foreground/60">/month</span>
                </p>
              </div>

              <ul className="flex flex-col gap-2 text-sm text-foreground/70">
                {FEATURE_ROWS.map((row) => (
                  <li key={row.key} className="flex items-baseline gap-2">
                    <span className="text-foreground/40">—</span>
                    <span>{describeFeature(row.key, plan)}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-auto rounded-full px-4 py-2.5 text-center text-sm font-medium transition-opacity hover:opacity-90 ${
                  i === 1 ? "bg-foreground text-background" : "border border-foreground/15"
                }`}
              >
                Start Free
              </Link>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-foreground/50">
          Prices shown in AED, billed monthly via Stripe. Taxes may apply depending on your billing location. No
          enterprise/custom tiers exist yet — every business starts on one of the plans above.
        </p>
      </section>
    </main>
  );
}

function describeFeature(
  key: (typeof FEATURE_ROWS)[number]["key"],
  plan: { max_locations: number; max_staff: number; max_customers: number; email_enabled: boolean; whatsapp_enabled: boolean; sms_enabled: boolean; automation_enabled: boolean; advanced_analytics: boolean; white_label_enabled: boolean }
): string {
  switch (key) {
    case "locations":
      return `Up to ${plan.max_locations} location${plan.max_locations === 1 ? "" : "s"}`;
    case "staff":
      return `Up to ${plan.max_staff} staff accounts`;
    case "customers":
      return `Up to ${plan.max_customers.toLocaleString()} customers`;
    case "email":
      return plan.email_enabled ? "Included" : "Not included";
    case "whatsapp":
      return plan.whatsapp_enabled ? "Included" : "Not included";
    case "sms":
      return plan.sms_enabled ? "Included" : "Not included";
    case "automation":
      return plan.automation_enabled ? "Included" : "Not included";
    case "analytics":
      return plan.advanced_analytics ? "Included" : "Basic analytics only";
    case "white_label":
      return plan.white_label_enabled ? "Included" : "Not included";
  }
}
