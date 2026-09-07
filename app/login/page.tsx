import { LoginForm } from "./login-form";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;
  const redirectTo = safeRedirectPath(redirect_to);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <p className="text-sm text-foreground/70">Welcome back.</p>
      </div>
      <LoginForm redirectTo={redirectTo} />
    </main>
  );
}
