"use client";

import { useActionState } from "react";
import { updateBranding } from "./actions";
import { BUTTON_STYLES } from "@/lib/validation/branding";

const inputClass = "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";

type Branding = {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string | null;
  background_color: string;
  text_color: string;
  button_style: string;
};

export function BrandingForm({ branding }: { branding: Branding }) {
  const [state, formAction, pending] = useActionState(updateBranding, undefined);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4 rounded-lg border border-foreground/10 p-4">
      <label className="flex flex-col gap-1 text-sm">
        Logo URL
        <input name="logoUrl" defaultValue={branding.logo_url ?? ""} placeholder="https://…" className={inputClass} />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Primary color
          <input type="color" name="primaryColor" defaultValue={branding.primary_color} className="h-10 w-full rounded-md border border-foreground/15" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Background
          <input type="color" name="backgroundColor" defaultValue={branding.background_color} className="h-10 w-full rounded-md border border-foreground/15" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Text color
          <input type="color" name="textColor" defaultValue={branding.text_color} className="h-10 w-full rounded-md border border-foreground/15" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Secondary color (optional)
        <input type="color" name="secondaryColor" defaultValue={branding.secondary_color ?? "#000000"} className="h-10 w-24 rounded-md border border-foreground/15" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Button style
        <select name="buttonStyle" defaultValue={branding.button_style} className={inputClass}>
          {BUTTON_STYLES.map((style) => (
            <option key={style} value={style}>
              {style[0].toUpperCase() + style.slice(1)}
            </option>
          ))}
        </select>
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Saved.</p>}

      <button
        disabled={pending}
        type="submit"
        className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
