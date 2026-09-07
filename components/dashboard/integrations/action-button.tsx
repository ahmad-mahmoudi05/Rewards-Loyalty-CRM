"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/dashboard/integrations/actions";

export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = "primary",
}: {
  action: (formData: FormData) => Promise<ActionState>;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "ghost";
}) {
  const [state, formAction, pending] = useActionState(async (_state: ActionState, formData: FormData) => action(formData), undefined);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      <button
        disabled={pending}
        type="submit"
        className={
          variant === "primary"
            ? "w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
            : "w-fit rounded-full border border-foreground/15 px-5 py-2.5 text-sm font-medium hover:bg-foreground/5 disabled:opacity-60"
        }
      >
        {pending ? pendingLabel : label}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">{state.success}</p>}
    </form>
  );
}
