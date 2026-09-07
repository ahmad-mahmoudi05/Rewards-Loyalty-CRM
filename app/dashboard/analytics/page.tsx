import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

const RANGE_OPTIONS = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
] as const;

function resolveRange(rangeParam: string | undefined, fromParam: string | undefined, toParam: string | undefined) {
  if (rangeParam === "custom" && fromParam && toParam) {
    const from = new Date(fromParam);
    const to = new Date(toParam);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to) {
      return { key: "custom" as const, from, to, label: `${fromParam} → ${toParam}` };
    }
  }
  const match = RANGE_OPTIONS.find((r) => r.key === rangeParam) ?? RANGE_OPTIONS[1];
  const to = new Date();
  const from = new Date(to.getTime() - match.days * 86400000);
  return { key: match.key, from, to, label: match.label };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const { range, from: fromParam, to: toParam } = await searchParams;
  const { key, from, to, label } = resolveRange(range, fromParam, toParam);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const supabase = await createClient();
  const businessId = membership.business_id;

  const [
    { count: newCustomers },
    { data: transactions },
    { count: rewardsRedeemed },
    { data: campaigns },
    { count: automationsTriggered },
    { count: totalCustomers },
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", businessId).gte("created_at", fromIso).lte("created_at", toIso),
    supabase.from("transactions").select("total, customer_id, created_at").eq("business_id", businessId).eq("status", "COMPLETED").gte("created_at", fromIso).lte("created_at", toIso),
    supabase.from("rewards").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "REDEEMED").gte("redeemed_at", fromIso).lte("redeemed_at", toIso),
    supabase
      .from("campaigns")
      .select("id, name, channel, status, created_at, campaign_recipients(status)")
      .eq("business_id", businessId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("automation_runs").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "SENT").gte("triggered_at", fromIso).lte("triggered_at", toIso),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", businessId).lt("created_at", fromIso),
  ]);

  const trackedRevenue = (transactions ?? []).reduce((sum, t) => sum + Number(t.total ?? 0), 0);
  const uniqueCustomerIds = new Set((transactions ?? []).map((t) => t.customer_id));
  const returningCount = [...uniqueCustomerIds].length; // distinct customers who transacted in range (mix of new + existing)
  const newVsExisting = {
    new: newCustomers ?? 0,
    existing: Math.max(0, (totalCustomers ?? 0)),
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-foreground/70">Real numbers from your own data — no estimates, no fabricated trends.</p>
      </div>

      <RangePicker current={key} label={label} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="New customers" value={(newCustomers ?? 0).toLocaleString()} />
        <Stat label="Tracked revenue" value={`${membership.business.currency} ${trackedRevenue.toLocaleString()}`} />
        <Stat label="Transactions" value={(transactions?.length ?? 0).toLocaleString()} />
        <Stat label="Customers who transacted" value={returningCount.toLocaleString()} />
        <Stat label="Rewards redeemed" value={(rewardsRedeemed ?? 0).toLocaleString()} />
        <Stat label="Automations triggered" value={(automationsTriggered ?? 0).toLocaleString()} />
        <Stat label="Customers before this period" value={newVsExisting.existing.toLocaleString()} />
        <Stat label="Total customers today" value={((totalCustomers ?? 0) + (newCustomers ?? 0)).toLocaleString()} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Campaign performance</h2>
        {!campaigns?.length ? (
          <p className="rounded-lg border border-foreground/10 p-6 text-sm text-foreground/60">
            No campaigns created in this period.{" "}
            <Link href="/dashboard/campaigns/new" className="underline underline-offset-2">
              Send your first campaign
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-xs uppercase tracking-wide text-foreground/50">
                  <th className="px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Sent</th>
                  <th className="px-3 py-2">Delivered</th>
                  <th className="px-3 py-2">Failed</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const recipients = (c.campaign_recipients ?? []) as Array<{ status: string }>;
                  const sent = recipients.filter((r) => r.status !== "QUEUED").length;
                  const delivered = recipients.filter((r) => r.status === "DELIVERED" || r.status === "READ" || r.status === "CLICKED").length;
                  const failed = recipients.filter((r) => r.status === "FAILED").length;
                  return (
                    <tr key={c.id} className="border-b border-foreground/5 last:border-0">
                      <td className="px-3 py-2">
                        <Link href={`/dashboard/campaigns/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{c.channel}</td>
                      <td className="px-3 py-2">{c.status}</td>
                      <td className="px-3 py-2">{sent}</td>
                      <td className="px-3 py-2">{delivered}</td>
                      <td className="px-3 py-2">{failed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <p className="text-xs text-foreground/60">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RangePicker({ current, label }: { current: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((r) => (
          <Link
            key={r.key}
            href={`/dashboard/analytics?range=${r.key}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              current === r.key ? "bg-foreground text-background" : "border border-foreground/15 hover:bg-foreground/5"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>
      <form className="flex items-center gap-2 text-sm">
        <input type="hidden" name="range" value="custom" />
        <input type="date" name="from" className="rounded-md border border-foreground/15 bg-transparent px-2 py-1 text-xs" />
        <span className="text-foreground/40">to</span>
        <input type="date" name="to" className="rounded-md border border-foreground/15 bg-transparent px-2 py-1 text-xs" />
        <button type="submit" className="rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5">
          Apply
        </button>
      </form>
      {current === "custom" && <span className="text-xs font-medium text-foreground">{label}</span>}
    </div>
  );
}
