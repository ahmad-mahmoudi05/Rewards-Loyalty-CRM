"use client";

import { useActionState, useState } from "react";
import { createLocation } from "./actions";

const inputClass = "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";

export function CreateLocationForm() {
  const [state, formAction, pending] = useActionState(createLocation, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Add location
      </button>
    );
  }

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3 rounded-lg border border-foreground/10 p-4">
      <input name="name" placeholder="Location name" required className={inputClass} />
      <input name="address" placeholder="Address (optional)" className={inputClass} />
      <input name="phone" placeholder="Phone (optional)" className={inputClass} />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          disabled={pending}
          type="submit"
          className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="w-fit rounded-full px-5 py-2.5 text-sm font-medium hover:bg-foreground/5">
          Cancel
        </button>
      </div>
    </form>
  );
}
