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
