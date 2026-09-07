"use client";

import { useActionState } from "react";
import { acceptInvitation } from "./actions";

export function AcceptButton({ token }: { token: string }) {
  const boundAction = async () => acceptInvitation(token);
  const [state, formAction, pending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction}>
      <button
        disabled={pending}
        type="submit"
        className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Accept invitation"}
      </button>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
