import { requireBusinessContext } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { InviteStaffForm } from "./invite-form";

export default async function TeamPage() {
  const membership = await requireBusinessContext();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("business_members")
    .select("*, profile:profiles!business_members_profile_id_fkey(full_name, email)")
    .eq("business_id", membership.business_id)
    .order("created_at", { ascending: true });

  const canManageTeam = membership.role === "OWNER" || membership.role === "MANAGER";

  const { data: invitations } = canManageTeam
    ? await supabase
        .from("business_invitations")
        .select("id, email, role, expires_at, accepted_at")
        .eq("business_id", membership.business_id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-foreground/70">
          Staff can scan, search, record transactions, and redeem rewards. They never see
          billing, integration credentials, or business settings.
        </p>
      </div>

      {canManageTeam && <InviteStaffForm />}

      {invitations && invitations.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Pending invitations</h2>
          <div className="flex flex-col divide-y divide-foreground/10 rounded-lg border border-dashed border-foreground/15">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm">{inv.email}</span>
                <span className="text-xs text-foreground/60">
                  {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-foreground/10 rounded-lg border border-foreground/10">
        {members?.map((member) => (
          <div key={member.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{member.profile?.full_name ?? member.profile?.email}</p>
              <p className="text-xs text-foreground/60">{member.profile?.email}</p>
            </div>
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-foreground/70">
              {member.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
