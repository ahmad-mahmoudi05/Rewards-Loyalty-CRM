import { redirect } from "next/navigation";
import { getCurrentBusinessMembership, requireUser } from "@/lib/dal";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  await requireUser();

  const membership = await getCurrentBusinessMembership();
  if (membership) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">Set up your business</h1>
        <p className="text-sm text-foreground/70">
          Takes about a minute. You can fine-tune branding and loyalty rules afterward.
        </p>
      </div>
      <OnboardingForm />
    </main>
  );
}
