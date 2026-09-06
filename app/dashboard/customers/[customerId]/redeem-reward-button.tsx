"use client";

import { useActionState, useEffect } from "react";
import { redeemReward } from "./actions";

export function RedeemRewardButton({
  customerId,
  customerName,
  rewardId,
  rewardName,
  locationId,
  onRedeemed,
}: {
  customerId: string;
  /** Used only for the confirm-before-redeem prompt; not sent to the server. */
  customerName?: string;
  rewardId: string;
  rewardName?: string;
  locationId: string | null;
  /** See RecordTransactionForm's onRecorded — same purpose for the scanner. */
  onRedeemed?: () => void;
}) {
  const [state, formAction, pending] = useActionState(redeemReward.bind(null, customerId), undefined);

  useEffect(() => {
    if (state?.success) onRedeemed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  if (state?.success) {
    return <span className="text-sm font-medium text-green-700">Redeemed</span>;
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const label = rewardName ? `"${rewardName}"` : "this reward";
        const who = customerName ? ` for ${customerName}` : "";
        if (!window.confirm(`Redeem ${label}${who}? This can't be undone.`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="rewardId" value={rewardId} />
      {locationId && <input type="hidden" name="locationId" value={locationId} />}
      <button
        disabled={pending}
        type="submit"
        className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Redeeming…" : "Redeem"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
