import { notFound } from "next/navigation";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentUser } from "@/lib/dal";
import { AcceptButton } from "./accept-button";
import { AcceptInviteForm } from "./accept-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!z.uuid().safeParse(token).success) notFound();

  const service = createServiceRoleClient();
  const { data: invitation } = await service
    .from("business_invitations")
    .select("*, business:businesses(name)")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) notFound();

  const expired = new Date(invitation.expires_at) < new Date();
  const alreadyAccepted = Boolean(invitation.accepted_at);
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Join {invitation.business?.name}</h1>
        <p className="mt-2 text-sm text-foreground/70">
          You&apos;ve been invited as {invitation.role === "MANAGER" ? "a manager" : "staff"}.
        </p>
      </div>

      {alreadyAccepted ? (
        <p className="text-center text-sm text-foreground/60">This invitation has already been used.</p>
      ) : expired ? (
        <p className="text-center text-sm text-foreground/60">This invitation has expired. Ask the owner to resend it.</p>
      ) : user && user.email === invitation.email ? (
        <div className="flex justify-center">
          <AcceptButton token={token} />
        </div>
      ) : user ? (
        <p className="text-center text-sm text-red-600">
          This invitation is for {invitation.email}. Log out and log in with that email to accept it.
        </p>
      ) : (
        <AcceptInviteForm token={token} email={invitation.email} />
      )}
    </main>
  );
}
