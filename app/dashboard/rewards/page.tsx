import Link from "next/link";
import { requireBusinessContext } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "AVAILABLE", label: "Available" },
  { value: "REDEEMED", label: "Redeemed" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  REDEEMED: "bg-foreground/10 text-foreground/70",
  EXPIRED: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const membership = await requireBusinessContext();
  const { status } = await searchParams;
  const activeStatus = STATUS_FILTERS.some((f) => f.value === status) ? status! : "all";

  const supabase = await createClient();
  let query = supabase
    .from("rewards")
    .select("id, name, status, value, reward_type, generated_at, expires_at, redeemed_at, customer:customers(id, first_name, last_name, phone_normalized)")
    .eq("business_id", membership.business_id)
    .order("generated_at", { ascending: false })
    .limit(200);

  if (activeStatus !== "all") {
    query = query.eq("status", activeStatus);
  }

  const { data: rewards } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Rewards</h1>
        <p className="text-sm text-foreground/70">
          Every reward the loyalty engine has generated, its status, and who it belongs to. Redeem or reverse a
          specific reward from that customer&apos;s profile.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/dashboard/rewards" : `/dashboard/rewards?status=${f.value}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeStatus === f.value
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/15 text-foreground/70 hover:bg-foreground/5"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rewards?.length ? (
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-foreground/10 text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Reward</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Generated</th>
                <th className="px-4 py-3 font-medium">Redeemed / expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {rewards.map((r) => (
                <tr key={r.id} className="hover:bg-foreground/5">
                  <td className="px-4 py-3">
                    {r.customer ? (
                      <Link href={`/dashboard/customers/${r.customer.id}`} className="font-medium underline-offset-2 hover:underline">
                        {r.customer.first_name} {r.customer.last_name ?? ""}
                      </Link>
                    ) : (
                      <span className="text-foreground/40">Deleted customer</span>
                    )}
                    {r.customer?.phone_normalized && (
                      <p className="text-xs text-foreground/50">{r.customer.phone_normalized}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[r.status] ?? "bg-foreground/10")}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {r.generated_at ? new Date(r.generated_at).toLocaleDateString() : "–"}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {r.status === "REDEEMED" && r.redeemed_at
                      ? new Date(r.redeemed_at).toLocaleDateString()
                      : r.expires_at
                        ? `Expires ${new Date(r.expires_at).toLocaleDateString()}`
                        : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-foreground/15 p-10 text-center">
          <p className="text-sm font-medium">
            {activeStatus === "all" ? "No rewards generated yet." : `No ${activeStatus.toLowerCase()} rewards.`}
          </p>
          {activeStatus === "all" && (
            <p className="mt-1 text-sm text-foreground/60">
              Rewards appear automatically once a customer crosses your loyalty program&apos;s threshold.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
