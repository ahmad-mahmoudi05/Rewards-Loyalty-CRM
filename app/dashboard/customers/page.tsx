import Link from "next/link";
import { requireBusinessContext } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { SignupQrCard } from "@/components/dashboard/signup-qr-card";
import { cn, daysAgoIso } from "@/lib/utils";
import { CUSTOMER_FILTERS, type CustomerFilter } from "./filters";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const membership = await requireBusinessContext();
  const { q, filter } = await searchParams;
  const activeFilter = (CUSTOMER_FILTERS.some((f) => f.value === filter) ? filter : "all") as CustomerFilter;

  const supabase = await createClient();
  const thirtyDaysAgo = daysAgoIso(30);

  let query = supabase
    .from("customer_summary")
    .select("*")
    .eq("business_id", membership.business_id)
    .order("created_at", { ascending: false });

  if (q) {
    const term = q.trim();
    query = query.or(`first_name.ilike.%${term}%,phone_normalized.ilike.%${term}%,email.ilike.%${term}%`);
  }

  switch (activeFilter as CustomerFilter) {
    case "new":
      query = query.gte("created_at", thirtyDaysAgo);
      break;
    case "returning":
      query = query.gte("transaction_count", 2);
      break;
    case "reward_available":
      query = query.gt("available_rewards_count", 0);
      break;
    case "whatsapp":
      query = query.eq("whatsapp_subscribed", true);
      break;
    case "sms":
      query = query.eq("sms_subscribed", true);
      break;
    case "email":
      query = query.eq("email_subscribed", true);
      break;
    case "inactive":
      query = query.or(
        `last_transaction_at.lt.${thirtyDaysAgo},and(last_transaction_at.is.null,created_at.lt.${thirtyDaysAgo})`
      );
      break;
  }

  const { data: customers } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-foreground/70">Everyone who has joined your loyalty program.</p>
      </div>

      <SignupQrCard businessSlug={membership.business.slug} />

      <form className="flex flex-wrap items-center gap-3" action="/dashboard/customers">
        {activeFilter !== "all" && <input type="hidden" name="filter" value={activeFilter} />}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, phone, or email"
          className="w-64 rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
        <button type="submit" className="rounded-md border border-foreground/15 px-3 py-2 text-sm hover:bg-foreground/5">
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {CUSTOMER_FILTERS.map((f) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (f.value !== "all") params.set("filter", f.value);
          const href = params.toString() ? `/dashboard/customers?${params}` : "/dashboard/customers";
          return (
            <Link
              key={f.value}
              href={href}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeFilter === f.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/15 text-foreground/70 hover:bg-foreground/5"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {customers?.length ? (
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-foreground/10 text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Loyalty</th>
                <th className="px-4 py-3 font-medium">Visits</th>
                <th className="px-4 py-3 font-medium">Total spend</th>
                <th className="px-4 py-3 font-medium">Rewards</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-foreground/5">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/customers/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                      {c.first_name} {c.last_name ?? ""}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{c.phone_normalized}</td>
                  <td className="px-4 py-3 text-foreground/70">
                    {c.loyalty_type === "STAMPS"
                      ? `${c.stamps_count ?? 0} / ${c.stamp_required_count ?? "–"}`
                      : c.loyalty_type === "POINTS"
                        ? `${c.points_balance ?? 0} / ${c.points_reward_threshold ?? "–"}`
                        : "–"}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{c.transaction_count}</td>
                  <td className="px-4 py-3 text-foreground/70">{c.total_spend}</td>
                  <td className="px-4 py-3">
                    {(c.available_rewards_count ?? 0) > 0 ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        {c.available_rewards_count} available
                      </span>
                    ) : (
                      <span className="text-foreground/40">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-foreground/15 p-10 text-center">
          <p className="text-sm font-medium">
            {q || activeFilter !== "all" ? "No customers match this search." : "No customers yet."}
          </p>
          {!q && activeFilter === "all" && (
            <p className="mt-1 text-sm text-foreground/60">
              Share your signup QR above and your customer base will start building here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
