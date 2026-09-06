"use client";

import { useActionState } from "react";
import { BUSINESS_TYPES } from "@/lib/validation/onboarding";
import { createBusiness } from "./actions";

const inputClass =
  "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";
const labelClass = "text-sm font-medium";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createBusiness, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          Your business
        </h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="businessName" className={labelClass}>
            Business name
          </label>
          <input id="businessName" name="businessName" required className={inputClass} placeholder="Brew Café" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="businessType" className={labelClass}>
            Business type
          </label>
          <select id="businessType" name="businessType" required defaultValue="COFFEE_SHOP" className={inputClass}>
            {BUSINESS_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="country" className={labelClass}>
              Country
            </label>
            <input id="country" name="country" defaultValue="AE" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="currency" className={labelClass}>
              Currency
            </label>
            <input id="currency" name="currency" defaultValue="AED" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="timezone" className={labelClass}>
              Timezone
            </label>
            <input id="timezone" name="timezone" defaultValue="Asia/Dubai" className={inputClass} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          First location
        </h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="locationName" className={labelClass}>
            Location name
          </label>
          <input
            id="locationName"
            name="locationName"
            required
            className={inputClass}
            placeholder="Yas Island"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="locationAddress" className={labelClass}>
            Address (optional)
          </label>
          <input id="locationAddress" name="locationAddress" className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="locationPhone" className={labelClass}>
            Phone (optional)
          </label>
          <input id="locationPhone" name="locationPhone" className={inputClass} />
        </div>
      </section>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending}
        type="submit"
        className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Setting up…" : "Create business"}
      </button>
    </form>
  );
}
