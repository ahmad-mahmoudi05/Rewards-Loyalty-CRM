import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-foreground/10 text-foreground/70",
  SCHEDULED: "bg-blue-100 text-blue-800",
  QUEUED: "bg-blue-100 text-blue-800",
  SENDING: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  PARTIALLY_FAILED: "bg-orange-100 text-orange-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-foreground/10 text-foreground/50",
};

export default async function CampaignsPage() {
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, channel, status, created_at, scheduled_at")
    .eq("business_id", membership.business_id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-foreground/70">Reach customers by segment, on the channel they opted into.</p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Create campaign
        </Link>
      </div>

      {campaigns?.length ? (
        <div className="flex flex-col divide-y divide-foreground/10 rounded-lg border border-foreground/10">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/campaigns/${c.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-foreground/5"
            >
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-foreground/60">
                  {c.channel} · {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? ""}`}>
                {c.status}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-foreground/15 p-10 text-center">
          <p className="text-sm font-medium">No campaigns yet.</p>
          <p className="mt-1 text-sm text-foreground/60">Create your first campaign and bring customers back.</p>
          <Link
            href="/dashboard/campaigns/new"
            className="mt-4 inline-block rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Create campaign
          </Link>
        </div>
      )}
    </div>
  );
}
