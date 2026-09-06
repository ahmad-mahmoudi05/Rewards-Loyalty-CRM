"use client";

import { useActionState, useState } from "react";
import { reverseTransactionAction } from "./actions";

export function ReverseTransactionButton({ customerId, transactionId }: { customerId: string; transactionId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reverseTransactionAction.bind(null, customerId), undefined);

  if (state?.success) {
    return <span className="text-xs text-foreground/50">Reversed</span>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-foreground/50 hover:text-red-600">
        Reverse
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="transactionId" value={transactionId} />
      <input
        name="reason"
        required
        minLength={3}
        placeholder="Reason (required)"
        className="w-40 rounded border border-foreground/15 bg-transparent px-2 py-1 text-xs outline-none focus:border-foreground/40"
      />
      <button
        disabled={pending}
        type="submit"
        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
      >
        {pending ? "…" : "Confirm"}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
