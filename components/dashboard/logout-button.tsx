"use client";

import { useActionState } from "react";
import { logout } from "@/app/dashboard/actions";

export function LogoutButton() {
  const [, formAction, pending] = useActionState(logout, undefined);

  return (
    <form action={formAction} className="px-3 pt-3 md:pt-0">
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-60"
      >
        {pending ? "Logging out…" : "Log out"}
      </button>
    </form>
  );
}
