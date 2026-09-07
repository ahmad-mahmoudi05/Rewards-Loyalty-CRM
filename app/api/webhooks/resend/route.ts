import { NextResponse, type NextRequest } from "next/server";
import { Webhook, WebhookVerificationError } from "svix";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Resend delivers webhooks signed the same way Svix signs its own —
 * verifying with the `svix` package against RESEND_WEBHOOK_SECRET (from the
 * Resend dashboard's Webhooks page) is Resend's own documented method.
 * Never trust an arbitrary POST here (Part 64).
 */

const EVENT_TO_RECIPIENT_STATUS: Record<string, string> = {
  "email.delivered": "DELIVERED",
  "email.opened": "READ",
  "email.clicked": "CLICKED",
  "email.bounced": "FAILED",
  "email.failed": "FAILED",
};

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 501 });
  }

  const rawBody = await request.text();
  const svixHeaders = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };

  try {
    // svix's Webhook.verify() only verifies the signature (throws on
    // failure) — it deliberately does not parse the body for us, so we do
    // that ourselves immediately after, only once the signature is proven valid.
    new Webhook(secret).verify(rawBody, svixHeaders);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
    throw err;
  }

  const event = JSON.parse(rawBody) as { type: string; created_at: string; data: Record<string, unknown> };

  const providerMessageId = event.data.email_id as string | undefined;
  if (!providerMessageId) {
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceRoleClient();

  const { data: recipient } = await supabase
    .from("campaign_recipients")
    .select("id, business_id, customer_id, status")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (!recipient) {
    // Not one of ours (or a test send with no recipient row) — acknowledge,
    // nothing to update.
    return NextResponse.json({ received: true });
  }

  // Idempotent: message_events has a unique index on (provider_message_id,
  // event_type) — a retried webhook delivery simply fails this insert and
  // we still return 200 so the provider stops retrying.
  const { error: insertError } = await supabase.from("message_events").insert({
    business_id: recipient.business_id,
    campaign_recipient_id: recipient.id,
    event_type: event.type,
    provider_message_id: providerMessageId,
    payload: event.data as Database["public"]["Tables"]["message_events"]["Insert"]["payload"],
  });

  if (insertError?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const newStatus = EVENT_TO_RECIPIENT_STATUS[event.type];
  if (newStatus) {
    const timestampField =
      newStatus === "DELIVERED" ? "delivered_at" : newStatus === "READ" ? "read_at" : newStatus === "CLICKED" ? "clicked_at" : null;

    // Never downgrade a terminal-ish status backwards (e.g. a late
    // "delivered" arriving after we already recorded "clicked").
    const statusRank = ["SENT", "DELIVERED", "READ", "CLICKED"];
    const shouldUpdateStatus =
      !statusRank.includes(recipient.status) || statusRank.indexOf(newStatus) >= statusRank.indexOf(recipient.status);

    await supabase
      .from("campaign_recipients")
      .update({
        ...(shouldUpdateStatus ? { status: newStatus } : {}),
        ...(timestampField ? { [timestampField]: event.created_at } : {}),
        ...(newStatus === "FAILED" ? { failure_reason: JSON.stringify(event.data).slice(0, 500) } : {}),
      })
      .eq("id", recipient.id);
  }

  if (event.type === "email.bounced" || event.type === "email.complained") {
    // Suppression (Part 66): reuse customer_consents rather than a new table.
    await supabase
      .from("customer_consents")
      .upsert(
        {
          business_id: recipient.business_id,
          customer_id: recipient.customer_id,
          channel: "EMAIL",
          status: "REVOKED",
          revoked_at: new Date().toISOString(),
          source: event.type === "email.bounced" ? "EMAIL_BOUNCE" : "EMAIL_COMPLAINT",
        },
        { onConflict: "business_id,customer_id,channel" }
      );
  }

  return NextResponse.json({ received: true });
}
