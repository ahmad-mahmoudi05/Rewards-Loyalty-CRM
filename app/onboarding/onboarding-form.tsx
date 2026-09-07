"use client";

import { useActionState, useState } from "react";
import { BUSINESS_TYPES, PLAN_CHOICES } from "@/lib/validation/onboarding";
import { createBusiness } from "./actions";

const inputClass =
  "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";
const labelClass = "text-sm font-medium";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createBusiness, undefined);
  const [planCode, setPlanCode] = useState<string>("GROWTH");

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <ol className="flex items-center justify-center gap-2 text-xs font-medium text-foreground/50">
        <li className="rounded-full bg-foreground px-3 py-1 text-background">1. Business</li>
        <li className="rounded-full bg-foreground/10 px-3 py-1">2. Plan</li>
        <li className="rounded-full bg-foreground/10 px-3 py-1">3. Dashboard</li>
      </ol>

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

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          Start your 14-day free trial
        </h2>
        <p className="text-xs text-foreground/60">
          No payment required now. Pick the plan closest to what you&apos;ll need — you can
          change it anytime in Billing.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLAN_CHOICES.map((plan) => (
            <label
              key={plan.code}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors ${
                planCode === plan.code ? "border-foreground bg-foreground/5" : "border-foreground/15 hover:bg-foreground/5"
              }`}
            >
              <input
                type="radio"
                name="planCode"
                value={plan.code}
                checked={planCode === plan.code}
                onChange={() => setPlanCode(plan.code)}
                className="sr-only"
              />
              <span className="font-medium">{plan.label}</span>
              <span className="text-xs text-foreground/60">{plan.blurb}</span>
            </label>
          ))}
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
