"use client";

import { useActionState, useEffect } from "react";
import { redeemOffer } from "./actions";

export function RedeemOfferButton({
  customerId,
  offerId,
  offerLabel,
  locationId,
  onRedeemed,
}: {
  customerId: string;
  offerId: string;
  offerLabel: string;
  locationId: string | null;
  onRedeemed?: () => void;
}) {
  const [state, formAction, pending] = useActionState(redeemOffer.bind(null, customerId), undefined);

  useEffect(() => {
    if (state?.success) onRedeemed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  if (state?.success) {
    return <span className="text-sm font-medium text-green-700">Applied</span>;
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Apply "${offerLabel}"? This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="offerId" value={offerId} />
      {locationId && <input type="hidden" name="locationId" value={locationId} />}
      <button
        disabled={pending}
        type="submit"
        className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Applying…" : "Apply / Redeem"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
