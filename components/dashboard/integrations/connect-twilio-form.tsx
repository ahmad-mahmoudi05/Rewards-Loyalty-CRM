"use client";

import { useActionState } from "react";
import { connectTwilio } from "@/app/dashboard/integrations/actions";

const inputClass = "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";
const labelClass = "text-sm font-medium";

export function ConnectTwilioForm() {
  const [state, formAction, pending] = useActionState(connectTwilio, undefined);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4 rounded-lg border border-foreground/10 p-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Account SID</label>
        <input name="accountSid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Auth token</label>
        <input name="authToken" type="password" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Sender number</label>
        <input name="fromNumber" placeholder="+15551234567" required className={inputClass} />
      </div>

      <p className="text-xs text-foreground/60">
        UAE launch requires a registered Sender ID for reliable delivery — see docs/integrations.md. A successful
        connection here does not by itself guarantee UAE delivery.
      </p>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">{state.success}</p>}

      <button
        disabled={pending}
        type="submit"
        className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Connecting…" : "Connect Twilio"}
      </button>
    </form>
  );
}
