import { notFound } from "next/navigation";
import { requireBusinessContext } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { RecordTransactionForm } from "./record-transaction-form";
import { RedeemRewardButton } from "./redeem-reward-button";
import { ReverseTransactionButton } from "./reverse-transaction-button";
import { RotateTokenButton } from "./rotate-token-button";

function formatDateTime(value: string | null) {
  if (!value) return "–";
  return new Date(value).toLocaleString();
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const membership = await requireBusinessContext();
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customer_summary")
    .select("*")
    .eq("id", customerId)
    .eq("business_id", membership.business_id)
    .maybeSingle();

  if (!customer) {
    notFound();
  }

  const [{ data: transactions }, { data: ledger }, { data: rewards }, { data: consents }, { data: primaryLocation }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("id, total, currency, status, created_at, location:locations(name)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("loyalty_transactions")
        .select("id, transaction_type, points_delta, stamps_delta, description, created_at, reversed_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("rewards")
        .select("id, name, status, generated_at, expires_at, redeemed_at")
        .eq("customer_id", customerId)
        .order("generated_at", { ascending: false }),
      supabase
        .from("customer_consents")
        .select("channel, status, consented_at, revoked_at, source")
        .eq("customer_id", customerId)
        .order("channel", { ascending: true }),
      supabase
        .from("locations")
        .select("id")
        .eq("business_id", membership.business_id)
        .eq("is_primary", true)
        .maybeSingle(),
    ]);

  const availableRewards = (rewards ?? []).filter((r) => r.status === "AVAILABLE");
  const canManage = membership.role === "OWNER" || membership.role === "MANAGER";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {customer.first_name} {customer.last_name ?? ""}
          </h1>
          <p className="text-sm text-foreground/70">
            {customer.phone_normalized} {customer.email ? `· ${customer.email}` : ""}
          </p>
          <p className="text-xs text-foreground/50">
            Joined {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : "–"}
            {customer.birthday ? ` · Birthday ${new Date(customer.birthday).toLocaleDateString()}` : ""}
          </p>
          {canManage && <RotateTokenButton customerId={customerId} />}
        </div>

        <div className="grid grid-cols-2 gap-4 text-right sm:grid-cols-4">
          <div>
            <p className="text-xs text-foreground/50">Visits</p>
            <p className="text-lg font-semibold">{customer.transaction_count}</p>
          </div>
          <div>
            <p className="text-xs text-foreground/50">Total spend</p>
            <p className="text-lg font-semibold">{customer.total_spend}</p>
          </div>
          <div>
            <p className="text-xs text-foreground/50">Last visit</p>
            <p className="text-lg font-semibold">
              {customer.last_transaction_at ? new Date(customer.last_transaction_at).toLocaleDateString() : "–"}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground/50">Rewards available</p>
            <p className="text-lg font-semibold">{customer.available_rewards_count}</p>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="text-base font-medium">Loyalty</h2>
        {customer.loyalty_program_id ? (
          <>
            <p className="text-sm text-foreground/70">
              {customer.loyalty_program_name} —{" "}
              {customer.loyalty_type === "STAMPS"
                ? `${customer.stamps_count ?? 0} / ${customer.stamp_required_count} qualifying visits`
                : `${customer.points_balance ?? 0} / ${customer.points_reward_threshold} points`}
            </p>

            {availableRewards.length > 0 && (
              <div className="flex flex-col gap-2">
                {availableRewards.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-md bg-green-50 px-4 py-2 text-sm text-green-900"
                  >
                    <span>{r.name}</span>
                    <RedeemRewardButton
                      customerId={customerId}
                      customerName={customer.first_name ?? undefined}
                      rewardId={r.id}
                      rewardName={r.name}
                      locationId={primaryLocation?.id ?? null}
                    />
                  </div>
                ))}
              </div>
            )}

            <RecordTransactionForm
              customerId={customerId}
              loyaltyProgramId={customer.loyalty_program_id}
              locationId={primaryLocation?.id ?? null}
              currency={membership.business.currency}
            />
          </>
        ) : (
          <p className="text-sm text-foreground/60">
            No active loyalty program yet — create one in Loyalty to start recording transactions.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Transactions</h2>
        {transactions?.length ? (
          <div className="overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-foreground/10 text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  {canManage && <th className="px-4 py-2 font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {transactions.map((t) => (
                  <tr key={t.id} className={t.status === "VOID" ? "opacity-50" : undefined}>
                    <td className="px-4 py-2 text-foreground/70">{formatDateTime(t.created_at)}</td>
                    <td className="px-4 py-2">
                      {t.currency} {t.total}
                    </td>
                    <td className="px-4 py-2 text-foreground/70">{t.location?.name ?? "–"}</td>
                    <td className="px-4 py-2 text-foreground/70">{t.status}</td>
                    {canManage && (
                      <td className="px-4 py-2 text-right">
                        {t.status === "COMPLETED" && (
                          <ReverseTransactionButton customerId={customerId} transactionId={t.id} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-foreground/60">No transactions recorded yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Loyalty ledger</h2>
        {ledger?.length ? (
          <div className="overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-foreground/10 text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Points</th>
                  <th className="px-4 py-2 font-medium">Stamps</th>
                  <th className="px-4 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {ledger.map((l) => (
                  <tr key={l.id} className={l.reversed_at ? "opacity-50" : undefined}>
                    <td className="px-4 py-2 text-foreground/70">{formatDateTime(l.created_at)}</td>
                    <td className="px-4 py-2">{l.transaction_type}</td>
                    <td className="px-4 py-2">{l.points_delta}</td>
                    <td className="px-4 py-2">{l.stamps_delta}</td>
                    <td className="px-4 py-2 text-foreground/70">{l.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-foreground/60">No loyalty activity yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Rewards</h2>
        {rewards?.length ? (
          <div className="overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-foreground/10 text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Reward</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Generated</th>
                  <th className="px-4 py-2 font-medium">Redeemed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {rewards.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-foreground/70">{r.status}</td>
                    <td className="px-4 py-2 text-foreground/70">{formatDateTime(r.generated_at)}</td>
                    <td className="px-4 py-2 text-foreground/70">{formatDateTime(r.redeemed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-foreground/60">No rewards have been earned yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Marketing consent</h2>
        {consents?.length ? (
          <div className="overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-foreground/10 text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Channel</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Since</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {consents.map((c) => (
                  <tr key={c.channel}>
                    <td className="px-4 py-2">{c.channel}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          c.status === "GRANTED"
                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                            : "rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-foreground/60"
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-foreground/70">
                      {formatDateTime(c.status === "GRANTED" ? c.consented_at : c.revoked_at)}
                    </td>
                    <td className="px-4 py-2 text-foreground/70">{c.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-foreground/60">No consent recorded yet.</p>
        )}
      </section>
    </div>
  );
}
