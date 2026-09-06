"use client";

import { useActionState } from "react";
import { recordTransaction } from "./actions";

export function RecordTransactionForm({
  customerId,
  loyaltyProgramId,
  locationId,
  currency,
}: {
  customerId: string;
  loyaltyProgramId: string;
  locationId: string | null;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState(recordTransaction, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="loyaltyProgramId" value={loyaltyProgramId} />
      {locationId && <input type="hidden" name="locationId" value={locationId} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="total" className="text-xs font-medium text-foreground/70">
          Transaction amount ({currency})
        </label>
        <input
          id="total"
          name="total"
          type="number"
          min={0.01}
          step="0.01"
          required
          className="w-36 rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
      </div>

      <button
        disabled={pending}
        type="submit"
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Recording…" : "Record transaction"}
      </button>

      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-green-700">Transaction recorded.</p>}
    </form>
  );
}
