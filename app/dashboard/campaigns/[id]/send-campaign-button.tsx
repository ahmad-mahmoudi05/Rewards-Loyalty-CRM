"use client";

import { useActionState } from "react";
import { sendCampaign } from "../actions";

export function SendCampaignButton({ campaignId, eligibleCount }: { campaignId: string; eligibleCount: number }) {
  const boundAction = async () => sendCampaign(campaignId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Send this campaign to ${eligibleCount} customers now? This can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        disabled={pending || eligibleCount === 0}
        type="submit"
        className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send now"}
      </button>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-green-700">Campaign queued — sending in the background.</p>}
    </form>
  );
}
