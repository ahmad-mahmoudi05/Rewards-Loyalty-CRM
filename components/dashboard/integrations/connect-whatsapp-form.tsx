"use client";

import { useActionState, useState } from "react";
import { connectWhatsAppManual } from "@/app/dashboard/integrations/actions";

const inputClass = "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";
const labelClass = "text-sm font-medium";

export function ConnectWhatsAppForm() {
  const [state, formAction, pending] = useActionState(connectWhatsAppManual, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-fit text-sm font-medium underline underline-offset-2">
        Enter WABA credentials manually
      </button>
    );
  }

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4 rounded-lg border border-foreground/10 p-4">
      <p className="text-xs text-foreground/60">
        From Meta Business Manager → WhatsApp → API Setup for a WABA you already control. Stored server-side only,
        never sent to the browser again — see docs/architecture.md.
      </p>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Phone number ID</label>
        <input name="phoneNumberId" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>WhatsApp Business Account ID</label>
        <input name="wabaId" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Access token</label>
        <input name="accessToken" type="password" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Display phone number (optional)</label>
        <input name="displayPhoneNumber" className={inputClass} />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">{state.success}</p>}

      <div className="flex gap-2">
        <button
          disabled={pending}
          type="submit"
          className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Connecting…" : "Connect"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="w-fit rounded-full px-5 py-2.5 text-sm font-medium hover:bg-foreground/5">
          Cancel
        </button>
      </div>
    </form>
  );
}
