"use client";

import { useActionState } from "react";
import { sendTestEmail } from "../actions";

export function TestSendForm({ campaignId }: { campaignId: string }) {
  const [state, formAction, pending] = useActionState(sendTestEmail, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="destination" className="text-xs font-medium text-foreground/70">
          Send a test to
        </label>
        <input
          id="destination"
          name="destination"
          type="email"
          required
          placeholder="you@example.com"
          className="w-56 rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
      </div>
      <button
        disabled={pending}
        type="submit"
        className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send test"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-green-700">Test sent.</p>}
    </form>
  );
}
