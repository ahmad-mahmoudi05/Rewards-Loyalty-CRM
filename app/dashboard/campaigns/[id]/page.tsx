import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchSegmentCustomers, summarizeAudience, SEGMENTS, type AudienceDefinition } from "@/services/campaigns/segments";
import { SendCampaignButton } from "./send-campaign-button";
import { TestSendForm } from "./test-send-form";

const RECIPIENT_STATUSES = [
  "QUEUED",
  "SENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "CLICKED",
  "FAILED",
  "SKIPPED_NO_CONSENT",
  "SKIPPED_INVALID_ADDRESS",
  "UNSUBSCRIBED",
  "CANCELLED",
] as const;

const ATTRIBUTION_WINDOW_DAYS = 14;

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("business_id", membership.business_id)
    .maybeSingle();

  if (!campaign) notFound();

  const audience = campaign.audience_definition as AudienceDefinition;
  const segmentLabel = SEGMENTS.find((s) => s.key === audience.segment)?.label ?? audience.segment;

  if (campaign.status === "DRAFT") {
    const rows = await fetchSegmentCustomers(supabase, membership.business_id, audience);
    const preview = summarizeAudience(rows, campaign.channel as "EMAIL" | "WHATSAPP" | "SMS");

    return (
      <div className="flex max-w-2xl flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold">{campaign.name}</h1>
          <p className="text-sm text-foreground/70">
            {segmentLabel} · {campaign.channel}
          </p>
        </div>

        <div className="rounded-lg border border-foreground/10 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Audience preview</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Matched" value={preview.matched} />
            <Stat label={`${campaign.channel} consent`} value={preview.channelSubscribed} />
            <Stat label="Valid destination" value={preview.validDestination} />
            <Stat label="Eligible" value={preview.eligible} highlight />
          </div>
          {preview.matched - preview.eligible > 0 && (
            <p className="mt-3 text-sm text-foreground/60">
              {preview.matched - preview.channelSubscribed} excluded — no {campaign.channel.toLowerCase()} consent.
              {preview.channelSubscribed - preview.validDestination > 0 &&
                ` ${preview.channelSubscribed - preview.validDestination} excluded — missing/invalid address.`}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-foreground/10 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Message preview</h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm">{campaign.message_body}</pre>
        </div>

        {campaign.channel === "EMAIL" && (
          <div className="rounded-lg border border-foreground/10 p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/50">Test send</h2>
            <TestSendForm campaignId={campaign.id} />
          </div>
        )}

        {campaign.scheduled_at && (
          <p className="text-sm text-foreground/70">
            Scheduled for {new Date(campaign.scheduled_at).toLocaleString()} ({membership.business.timezone})
          </p>
        )}

        <SendCampaignButton campaignId={campaign.id} eligibleCount={preview.eligible} />
      </div>
    );
  }

  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("status")
    .eq("campaign_id", campaign.id);

  const counts = Object.fromEntries(RECIPIENT_STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const r of recipients ?? []) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }
  const targeted = recipients?.length ?? 0;

  // Attribution (Part 46/47): documented MVP rule — a recipient who
  // transacted within ATTRIBUTION_WINDOW_DAYS after their message was sent
  // counts as an "attributed return". This is a temporal association, not a
  // claim of causation.
  const { data: sentRecipients } = await supabase
    .from("campaign_recipients")
    .select("customer_id, sent_at")
    .eq("campaign_id", campaign.id)
    .not("sent_at", "is", null);

  let returned = 0;
  let attributedRevenue = 0;
  if (sentRecipients?.length) {
    const customerIds = sentRecipients.map((r) => r.customer_id);
    const { data: txns } = await supabase
      .from("transactions")
      .select("customer_id, total, created_at")
      .in("customer_id", customerIds)
      .eq("status", "COMPLETED");

    for (const r of sentRecipients) {
      const windowEnd = new Date(new Date(r.sent_at!).getTime() + ATTRIBUTION_WINDOW_DAYS * 86400000);
      const match = txns?.find(
        (t) => t.customer_id === r.customer_id && new Date(t.created_at) >= new Date(r.sent_at!) && new Date(t.created_at) <= windowEnd
      );
      if (match) {
        returned++;
        attributedRevenue += Number(match.total);
      }
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        <p className="text-sm text-foreground/70">
          {segmentLabel} · {campaign.channel} · <span className="font-medium">{campaign.status}</span>
        </p>
      </div>

      <div className="rounded-lg border border-foreground/10 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Delivery</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Targeted" value={targeted} />
          <Stat label="Sent" value={counts.SENT + counts.DELIVERED + counts.READ + counts.CLICKED} />
          <Stat label="Delivered" value={counts.DELIVERED || "—"} />
          <Stat label="Failed" value={counts.FAILED} />
          <Stat label="Skipped (no consent)" value={counts.SKIPPED_NO_CONSENT} />
          <Stat label="Skipped (invalid)" value={counts.SKIPPED_INVALID_ADDRESS} />
          <Stat label="Unsubscribed" value={counts.UNSUBSCRIBED} />
          <Stat label="Still queued" value={counts.QUEUED + counts.SENDING} />
        </div>
      </div>

      <div className="rounded-lg border border-foreground/10 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          Attribution ({ATTRIBUTION_WINDOW_DAYS}-day window)
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Stat label="Attributed returns" value={returned} />
          <Stat label="Attributed revenue" value={attributedRevenue.toFixed(2)} />
        </div>
        <p className="mt-2 text-xs text-foreground/50">
          A customer who transacted within {ATTRIBUTION_WINDOW_DAYS} days of receiving this
          message — a temporal association, not a claim that the campaign caused the visit.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-foreground/50">{label}</p>
      <p className={`text-xl font-semibold ${highlight ? "text-green-700" : ""}`}>{value}</p>
    </div>
  );
}
