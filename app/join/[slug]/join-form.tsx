"use client";

import { useActionState } from "react";
import { joinBusiness } from "./actions";

export function JoinForm({ slug, accentColor }: { slug: string; accentColor: string }) {
  const [state, formAction, pending] = useActionState(joinBusiness, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="businessSlug" value={slug} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="firstName" className="text-sm font-medium">
          First name
        </label>
        <input
          id="firstName"
          name="firstName"
          required
          autoComplete="given-name"
          className="rounded-lg border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium">
          Mobile number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          placeholder="050 123 4567"
          autoComplete="tel"
          inputMode="tel"
          className="rounded-lg border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email (optional)
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="rounded-lg border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="birthday" className="text-sm font-medium">
          Birthday (optional)
        </label>
        <input
          id="birthday"
          name="birthday"
          type="date"
          className="rounded-lg border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-black/30"
        />
      </div>

      <fieldset className="flex flex-col gap-2 border-t border-black/10 pt-4">
        <legend className="pb-1 text-sm font-medium">Stay in touch (optional)</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="whatsappConsent" />
          WhatsApp offers and updates
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="smsConsent" />
          SMS offers and updates
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="emailConsent" />
          Email offers and updates
        </label>
      </fieldset>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending}
        type="submit"
        style={{ backgroundColor: accentColor }}
        className="mt-2 rounded-full px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join rewards"}
      </button>
    </form>
  );
}
