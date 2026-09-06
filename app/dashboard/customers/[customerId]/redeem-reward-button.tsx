"use client";

import { useActionState } from "react";
import { redeemReward } from "./actions";

export function RedeemRewardButton({
  customerId,
  rewardId,
  locationId,
}: {
  customerId: string;
  rewardId: string;
  locationId: string | null;
}) {
  const [state, formAction, pending] = useActionState(redeemReward.bind(null, customerId), undefined);

  if (state?.success) {
    return <span className="text-sm font-medium text-green-700">Redeemed</span>;
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
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
