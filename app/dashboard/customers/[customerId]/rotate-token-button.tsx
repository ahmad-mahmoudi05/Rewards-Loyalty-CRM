"use client";

import { useActionState } from "react";
import { rotateWalletTokenAction } from "./actions";

export function RotateTokenButton({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(rotateWalletTokenAction.bind(null, customerId), undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Reset this customer's loyalty QR? Their old QR/Wallet pass will stop working.")) {
          e.preventDefault();
        }
      }}
    >
      <button
        disabled={pending}
        type="submit"
        className="text-xs text-foreground/50 hover:text-foreground"
      >
        {pending ? "Resetting…" : "Reset loyalty QR"}
      </button>
      {state?.success && <span className="ml-2 text-xs text-green-700">New QR issued.</span>}
      {state?.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
