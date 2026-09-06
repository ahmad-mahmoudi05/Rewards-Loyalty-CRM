"use client";

import { RecordTransactionForm } from "@/app/dashboard/customers/[customerId]/record-transaction-form";
import { RedeemRewardButton } from "@/app/dashboard/customers/[customerId]/redeem-reward-button";
import type { OperationalView } from "@/app/dashboard/scanner/actions";

export function CustomerOperationalPanel({
  view,
  locationId,
  currency,
  onRefresh,
  onDone,
}: {
  view: OperationalView;
  locationId: string | null;
  currency: string;
  onRefresh: () => void;
  onDone: () => void;
}) {
  const { customer, rewards } = view;
  const last4 = customer.phone_normalized?.slice(-4) ?? "----";

  const progressLabel =
    customer.loyalty_type === "STAMPS"
      ? `${customer.stamps_count ?? 0} / ${customer.stamp_required_count ?? "–"} stamps`
      : customer.loyalty_type === "POINTS"
        ? `${customer.points_balance ?? 0} / ${customer.points_reward_threshold ?? "–"} points`
        : null;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-foreground/10 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-green-700">✓ Customer found</p>
          <h2 className="text-xl font-semibold">
            {customer.first_name} {customer.last_name ?? ""}
          </h2>
          <p className="text-sm text-foreground/60">•••• {last4}</p>
        </div>
        <button type="button" onClick={onDone} className="text-sm text-foreground/50 hover:text-foreground">
          Done
        </button>
      </div>

      {customer.loyalty_program_id ? (
        <div className="rounded-xl bg-foreground/5 p-4">
          <p className="text-sm font-medium">{customer.loyalty_program_name}</p>
          <p className="text-2xl font-semibold">{progressLabel}</p>
        </div>
      ) : (
        <p className="text-sm text-foreground/60">This business has no active loyalty program yet.</p>
      )}

      {rewards.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">🎁 Available rewards</p>
          {rewards.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-green-900">{r.name}</p>
                {r.expires_at && (
                  <p className="text-xs text-green-700">
                    Expires {new Date(r.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <RedeemRewardButton
                customerId={customer.id!}
                customerName={customer.first_name ?? undefined}
                rewardId={r.id}
                rewardName={r.name}
                locationId={locationId}
                onRedeemed={onRefresh}
              />
            </div>
          ))}
        </div>
      )}

      {customer.loyalty_program_id && (
        <div className="border-t border-foreground/10 pt-4">
          <RecordTransactionForm
            customerId={customer.id!}
            loyaltyProgramId={customer.loyalty_program_id}
            locationId={locationId}
            currency={currency}
            onRecorded={onRefresh}
          />
        </div>
      )}
    </div>
  );
}
