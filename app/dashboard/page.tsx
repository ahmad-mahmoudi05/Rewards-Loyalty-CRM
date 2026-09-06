import Link from "next/link";
import { requireBusinessContext } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardOverviewPage() {
  const membership = await requireBusinessContext();
  const supabase = await createClient();

  const [{ count: customerCount }, { count: redeemedCount }, { data: program }] = await Promise.all([
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", membership.business_id),
    supabase
      .from("rewards")
      .select("id", { count: "exact", head: true })
      .eq("business_id", membership.business_id)
      .eq("status", "REDEEMED"),
    supabase
      .from("loyalty_programs")
      .select("id")
      .eq("business_id", membership.business_id)
      .limit(1)
      .maybeSingle(),
  ]);

  const stats = [
    { label: "Customers", value: String(customerCount ?? 0) },
    { label: "Rewards redeemed", value: String(redeemedCount ?? 0) },
    { label: "Active campaigns", value: "0" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {membership.business.name}</h1>
        <p className="text-sm text-foreground/70">
          Here&apos;s what&apos;s happening across your loyalty program.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
    </div>
  );
}
