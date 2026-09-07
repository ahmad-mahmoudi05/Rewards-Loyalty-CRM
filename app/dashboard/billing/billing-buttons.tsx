"use client";

import { useActionState } from "react";
import { startCheckout, openBillingPortal } from "./actions";

export function CheckoutButton({ planCode, label }: { planCode: string; label: string }) {
  const [state, formAction, pending] = useActionState(async () => startCheckout(planCode), undefined);

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <button
        disabled={pending}
        type="submit"
        className="w-full rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Redirecting…" : label}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function ManageBillingButton() {
  const [state, formAction, pending] = useActionState(async () => openBillingPortal(), undefined);

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <button
        disabled={pending}
        type="submit"
        className="w-fit rounded-full border border-foreground/15 px-5 py-2.5 text-sm font-medium hover:bg-foreground/5 disabled:opacity-60"
      >
        {pending ? "Opening…" : "Manage billing"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
