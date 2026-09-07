"use client";

import { useActionState } from "react";
import { inviteStaffMember } from "./actions";

const inputClass =
  "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";

export function InviteStaffForm() {
  const [state, formAction, pending] = useActionState(inviteStaffMember, undefined);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-4">
      <h2 className="text-sm font-medium">Invite a team member</h2>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fullName" className="text-xs font-medium text-foreground/70">
            Full name
          </label>
          <input id="fullName" name="fullName" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-foreground/70">
            Email
          </label>
          <input id="email" name="email" type="email" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-xs font-medium text-foreground/70">
            Role
          </label>
          <select id="role" name="role" defaultValue="STAFF" className={inputClass}>
            <option value="STAFF">Staff</option>
            <option value="MANAGER">Manager</option>
          </select>
        </div>
        <button
          disabled={pending}
          type="submit"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </form>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
          Invitation sent to {state.email}. It expires in 7 days.
        </p>
      )}
    </div>
  );
}
