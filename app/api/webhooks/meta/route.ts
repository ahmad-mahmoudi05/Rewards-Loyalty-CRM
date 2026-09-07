import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { verifyMetaSignature } from "@/services/messaging/whatsapp";
import { normalizeWhatsAppId } from "@/lib/phone";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Meta WhatsApp Business Platform webhook (Day 4.5, closing the gap
 * documented in docs/integrations.md). Handles both halves Meta requires:
 * the GET verification challenge (subscribing the endpoint in the Meta App
 * Dashboard) and the POST event delivery (message status updates + inbound
 * customer messages, including opt-out keywords).
 *
 * Untested against a real Meta app (none exists in this environment — see
 * docs/integrations.md), but exercised end-to-end with correctly-signed
 * synthetic payloads shaped exactly like Meta's documented webhook body,
 * the same honesty standard already applied to the Resend webhook.
 */

const STATUS_TO_MESSAGE_EVENT: Record<string, string> = {
  sent: "whatsapp.sent",
  delivered: "whatsapp.delivered",
  read: "whatsapp.read",
  failed: "whatsapp.failed",
};

const RECIPIENT_STATUS_RANK = ["SENT", "DELIVERED", "READ"];

// Conservative: exact opt-out words only (trimmed, case-insensitive, minor
// trailing punctuation tolerated) — never a substring match, so ordinary
// conversational text ("please stop by later") is never misread as opt-out.
const OPT_OUT_WORDS = new Set(["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);

function isOptOutText(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = text.trim().toUpperCase().replace(/[.!?]+$/g, "");
  return OPT_OUT_WORDS.has(normalized);
}

type MetaStatus = {
  id: string;
  status: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
};

type MetaInboundMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
};

type MetaWebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        statuses?: MetaStatus[];
        messages?: MetaInboundMessage[];
      };
    }>;
  }>;
};

export async function GET(request: NextRequest) {
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 501 });
  }

  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 501 });
  }

  const rawBody = await request.text();
  const valid = verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as MetaWebhookBody;
  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceRoleClient();

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;
      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;

      // Tenant resolution: the phone_number_id in the payload maps 1:1 to
      // exactly one business's connected WABA (business_integrations.config
      // is per-tenant, never a global credential — see docs/architecture.md).
      let businessId: string | null = null;
      if (phoneNumberId) {
        const { data: integration } = await supabase
          .from("business_integrations")
          .select("business_id")
          .eq("provider", "WHATSAPP")
          .contains("config", { phoneNumberId })
          .maybeSingle();
        businessId = integration?.business_id ?? null;
      }

      await processStatuses(supabase, value.statuses ?? [], businessId);
      await processInboundMessages(supabase, value.messages ?? [], businessId, value.metadata?.display_phone_number ?? null);
    }
  }

  return NextResponse.json({ received: true });
}

async function processStatuses(supabase: ReturnType<typeof createServiceRoleClient>, statuses: MetaStatus[], businessId: string | null) {
  for (const status of statuses) {
    const eventType = STATUS_TO_MESSAGE_EVENT[status.status];
    if (!eventType) continue;

    // Resolve the send this status belongs to: campaign-originated first
    // (campaign_recipients.provider_message_id), then automation-originated
    // (automation_runs.action_result->>'provider_message_id' — see migration
    // 0022's expression index). A status for a message this system never
    // sent (or sent too long ago to still be tracked) is acknowledged and
    // dropped, exactly like the Resend webhook does for unknown ids.
    const { data: recipient } = await supabase
      .from("campaign_recipients")
      .select("id, business_id, status")
      .eq("provider_message_id", status.id)
      .maybeSingle();

    if (recipient) {
      // Defense in depth: the phone_number_id-resolved business must agree
      // with the business that owns this recipient row. A mismatch means
      // either a misconfigured integration or a spoofed id collision —
      // either way, never apply the update across tenants.
      if (businessId && recipient.business_id !== businessId) continue;

      const { error: insertError } = await supabase.from("message_events").insert({
        business_id: recipient.business_id,
        campaign_recipient_id: recipient.id,
        event_type: eventType,
        provider_message_id: status.id,
        payload: status as unknown as Database["public"]["Tables"]["message_events"]["Insert"]["payload"],
      });
      if (insertError?.code === "23505") continue; // duplicate delivery, already processed

      const newStatus = status.status === "sent" ? "SENT" : status.status === "delivered" ? "DELIVERED" : status.status === "read" ? "READ" : "FAILED";
      const shouldUpdateStatus =
        newStatus === "FAILED" ||
        !RECIPIENT_STATUS_RANK.includes(recipient.status) ||
        RECIPIENT_STATUS_RANK.indexOf(newStatus) >= RECIPIENT_STATUS_RANK.indexOf(recipient.status);

      const timestampField = newStatus === "DELIVERED" ? "delivered_at" : newStatus === "READ" ? "read_at" : newStatus === "FAILED" ? "failed_at" : null;

      await supabase
        .from("campaign_recipients")
        .update({
          ...(shouldUpdateStatus ? { status: newStatus } : {}),
          ...(timestampField ? { [timestampField]: new Date().toISOString() } : {}),
          ...(newStatus === "FAILED" ? { failure_reason: JSON.stringify(status.errors ?? {}).slice(0, 500) } : {}),
        })
        .eq("id", recipient.id);
      continue;
    }

    const { data: run } = await supabase
      .from("automation_runs")
      .select("id, business_id, action_result")
      .eq("action_result->>provider_message_id", status.id)
      .maybeSingle();

    if (run) {
      if (businessId && run.business_id !== businessId) continue;

      const { error: insertError } = await supabase.from("message_events").insert({
        business_id: run.business_id,
        campaign_recipient_id: null,
        event_type: eventType,
        provider_message_id: status.id,
        payload: status as unknown as Database["public"]["Tables"]["message_events"]["Insert"]["payload"],
      });
      if (insertError?.code === "23505") continue;

      const existingResult = (run.action_result as Record<string, unknown>) ?? {};
      await supabase
        .from("automation_runs")
        .update({
          action_result: { ...existingResult, delivery_status: status.status },
          ...(status.status === "failed" ? { status: "FAILED" } : {}),
        })
        .eq("id", run.id);
    }
  }
}

async function processInboundMessages(
  supabase: ReturnType<typeof createServiceRoleClient>,
  messages: MetaInboundMessage[],
  businessId: string | null,
  displayPhoneNumber: string | null
) {
  for (const message of messages) {
    const text = message.type === "text" ? (message.text?.body ?? null) : null;
    const fromNormalized = normalizeWhatsAppId(message.from);
    const fromAddress = fromNormalized.valid ? fromNormalized.e164 : message.from;
    const optOut = isOptOutText(text);

    let customerId: string | null = null;
    if (businessId && fromNormalized.valid) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("phone_normalized", fromNormalized.e164)
        .maybeSingle();
      customerId = customer?.id ?? null;
    }

    const { error: insertError } = await supabase.from("inbound_messages").insert({
      business_id: businessId,
      customer_id: customerId,
      channel: "WHATSAPP",
      from_address: fromAddress,
      to_address: displayPhoneNumber,
      provider_message_id: message.id,
      body: text,
      is_optout: optOut,
      raw_payload: message as unknown as Database["public"]["Tables"]["inbound_messages"]["Insert"]["raw_payload"],
    });

    if (insertError?.code === "23505") continue; // duplicate delivery, already processed

    if (optOut && businessId && customerId) {
      await supabase.from("customer_consents").upsert(
        {
          business_id: businessId,
          customer_id: customerId,
          channel: "WHATSAPP",
          status: "REVOKED",
          revoked_at: new Date().toISOString(),
          source: "WHATSAPP_STOP",
        },
        { onConflict: "business_id,customer_id,channel" }
      );
    }
  }
}
