import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Deliberately not in proxy.ts's PROTECTED_PREFIXES: a normal logged-out
  // visitor should see "request a new link", not be redirected straight to
  // /login (which would suggest they need a password they may have simply
  // forgotten, rather than telling them what actually happened).
  if (!user) {
    redirect("/forgot-password?error=link_expired");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
      </div>
      <ResetPasswordForm />
    </main>
  );
}
