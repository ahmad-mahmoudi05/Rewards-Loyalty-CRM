"use client";

import { useActionState } from "react";
import { updateBusinessSettings } from "./actions";
import { BUSINESS_TYPES } from "@/lib/validation/onboarding";

const inputClass = "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";

type Business = {
  name: string;
  business_type: string;
  country: string;
  currency: string;
  timezone: string;
};

export function SettingsForm({ business }: { business: Business }) {
  const [state, formAction, pending] = useActionState(updateBusinessSettings, undefined);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4 rounded-lg border border-foreground/10 p-4">
      <label className="flex flex-col gap-1 text-sm">
        Business name
        <input name="businessName" defaultValue={business.name} required className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Business type
        <select name="businessType" defaultValue={business.business_type} className={inputClass}>
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Country code
          <input name="country" defaultValue={business.country} maxLength={2} required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Currency
          <input name="currency" defaultValue={business.currency} maxLength={3} required className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Timezone
        <input name="timezone" defaultValue={business.timezone} required className={inputClass} />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Saved.</p>}

      <button
        disabled={pending}
        type="submit"
        className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
