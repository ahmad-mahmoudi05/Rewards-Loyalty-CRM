import Link from "next/link";
import { requireBusinessContext } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardOverviewPage() {
  const membership = await requireBusinessContext();
  const supabase = await createClient();
  const businessId = membership.business_id;

  const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 86400000).toISOString();

  const [
    { count: customerCount },
    { count: newCustomerCount },
    { count: redeemedCount },
    { count: transactionCount },
    { count: activeCampaignCount },
    { count: automationTriggeredCount },
    { data: revenueRows },
    { data: program },
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", businessId),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", businessId).gte("created_at", thirtyDaysAgo),
    supabase.from("rewards").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "REDEEMED"),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "COMPLETED").gte("created_at", thirtyDaysAgo),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["QUEUED", "SENDING", "SCHEDULED"]),
    supabase.from("automation_runs").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "SENT").gte("triggered_at", thirtyDaysAgo),
    supabase.from("transactions").select("total").eq("business_id", businessId).eq("status", "COMPLETED").gte("created_at", thirtyDaysAgo),
    supabase.from("loyalty_programs").select("id").eq("business_id", businessId).limit(1).maybeSingle(),
  ]);

  const trackedRevenue = (revenueRows ?? []).reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  const returningCustomerCount = Math.max(0, (customerCount ?? 0) - (newCustomerCount ?? 0));

  const stats = [
    { label: "Total customers", value: (customerCount ?? 0).toLocaleString() },
    { label: "New customers (30d)", value: (newCustomerCount ?? 0).toLocaleString() },
    { label: "Returning customers", value: returningCustomerCount.toLocaleString() },
    { label: "Tracked revenue (30d)", value: `${membership.business.currency} ${trackedRevenue.toLocaleString()}` },
    { label: "Transactions (30d)", value: (transactionCount ?? 0).toLocaleString() },
    { label: "Rewards redeemed", value: (redeemedCount ?? 0).toLocaleString() },
    { label: "Active campaigns", value: (activeCampaignCount ?? 0).toLocaleString() },
    { label: "Automations triggered (30d)", value: (automationTriggeredCount ?? 0).toLocaleString() },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {membership.business.name}</h1>
        <p className="text-sm text-foreground/70">
          Here&apos;s what&apos;s happening across your loyalty program.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-foreground/10 p-4">
            <p className="text-xs text-foreground/60">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      {!program && (
        <div className="rounded-lg border border-foreground/10 p-6">
          <h2 className="text-base font-medium">Set up your loyalty program</h2>
          <p className="mt-1 text-sm text-foreground/70">
            Choose stamps or points and configure your first reward. This unlocks customer
            signup and transactions.
          </p>
          <Link
            href="/dashboard/loyalty"
            className="mt-4 inline-block rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Configure loyalty
          </Link>
        </div>
      )}

      {(customerCount ?? 0) > 0 && (
        <div className="rounded-lg border border-foreground/10 p-6">
          <h2 className="text-base font-medium">See the full picture</h2>
          <p className="mt-1 text-sm text-foreground/70">
            Analytics has date-range filters, campaign performance, and new-vs-returning trends.
          </p>
          <Link
            href="/dashboard/analytics"
            className="mt-4 inline-block rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            View analytics
          </Link>
        </div>
      )}
    </div>
  );
}
