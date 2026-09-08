"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LogoutState = undefined;

// Signature matches useActionState's (prevState, formData) shape (see
// components/dashboard/logout-button.tsx) purely so the logout button can
// show real pending feedback like every other mutation in the app — the
// arguments themselves are unused.
export async function logout(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, formData) call signature
  _state?: LogoutState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, formData) call signature
  _formData?: FormData
): Promise<LogoutState> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
