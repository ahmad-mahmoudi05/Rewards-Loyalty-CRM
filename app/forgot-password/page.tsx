import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-foreground/70">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      <ForgotPasswordErrorBanner searchParams={searchParams} />
      <ForgotPasswordForm />
    </main>
  );
}

async function ForgotPasswordErrorBanner({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (error !== "link_expired") return null;
  return (
    <p className="rounded-md bg-yellow-50 px-3 py-2 text-center text-sm text-yellow-900">
      That reset link has expired or was already used. Request a new one below.
    </p>
  );
}
