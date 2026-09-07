"use client";

import { useActionState } from "react";
import { confirmUnsubscribe } from "./actions";

export function UnsubscribeButton({ token, businessName }: { token: string; businessName: string }) {
  const boundAction = async (state: Awaited<ReturnType<typeof confirmUnsubscribe>>) => confirmUnsubscribe(token, state);
  const [state, formAction, pending] = useActionState(boundAction, undefined);

  if (state?.success) {
    return <p className="text-sm text-foreground/70">You&apos;ve been unsubscribed from {businessName}&apos;s emails.</p>;
  }

  return (
    <form action={formAction}>
      <button
        disabled={pending}
        type="submit"
        className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Unsubscribing…" : "Confirm unsubscribe"}
      </button>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
