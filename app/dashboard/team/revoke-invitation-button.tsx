"use client";

import { useActionState } from "react";
import { revokeInvitation } from "./actions";

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const [state, formAction, pending] = useActionState(revokeInvitation, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
