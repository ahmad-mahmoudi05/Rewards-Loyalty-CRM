import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { validateTwilioSignature, type SmsIntegrationConfig } from "@/services/messaging/sms";
import { normalizePhone } from "@/lib/phone";
import { getSiteUrl } from "@/lib/site-url";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Twilio SMS webhook (Day 4.5) — one route handling both halves of Twilio's
 * SMS lifecycle: status callbacks (queued/sent/delivered/undelivered/failed,
 * pointed at this URL per-send by services/messaging/sms.ts's
 * `statusCallback`) and inbound messages (configured per-business on the
 * Twilio phone number itself, including STOP/opt-out keywords).
 *
 * Twilio signs every request with `X-Twilio-Signature`, computed from the
 * exact URL + POST params using *that Twilio account's* authToken. Each
 * business has its own Twilio subaccount/authToken (business_integrations,
 * never a single global secret) — the payload's own `AccountSid` field is
 * used to resolve which business's authToken to validate against, so a
 * request can never be accepted using the wrong tenant's credentials, and an
 * unrecognized AccountSid is rejected outright before any DB write.
 *
 * Untested against a real Twilio account (none exists in this environment —
 * see docs/integrations.md); exercised with correctly-signed synthetic
 * payloads shaped exactly like Twilio's documented webhook body.
 */

const STATUS_TO_RECIPIENT_STATUS: Record<string, string> = {
  sent: "SENT",
  delivered: "DELIVERED",
  undelivered: "FAILED",
  failed: "FAILED",
};

const RECIPIENT_STATUS_RANK = ["SENT", "DELIVERED"];

const OPT_OUT_WORDS = new Set(["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);

function isOptOutText(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = text.trim().toUpperCase().replace(/[.!?]+$/g, "");
  return OPT_OUT_WORDS.has(normalized);
}

const EMPTY_TWIML = new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
  status: 200,
  headers: { "Content-Type": "text/xml" },
});

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }

  const accountSid = params.AccountSid;
  const signatureHeader = request.headers.get("x-twilio-signature");
  if (!accountSid || !signatureHeader) {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: integration } = await supabase
    .from("business_integrations")
    .select("business_id, config")
    .eq("provider", "SMS_TWILIO")
    .contains("config", { accountSid })
    .maybeSingle();

  if (!integration) {
    // Unknown account: cannot validate a signature without its authToken,
    // and never trust an unsigned/unverifiable request.
    return NextResponse.json({ error: "Unknown account." }, { status: 404 });
  }

  const config = integration.config as Partial<SmsIntegrationConfig>;
  const businessId = integration.business_id;
  const callbackUrl = `${await getSiteUrl()}/api/webhooks/twilio`;

  const valid =
    Boolean(config.authToken) &&
    validateTwilioSignature({ authToken: config.authToken!, signatureHeader, url: callbackUrl, body: params });

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  if (params.MessageStatus) {
    await processStatusCallback(supabase, params, businessId);
  } else if (typeof params.Body === "string") {
    await processInboundSms(supabase, params, businessId);
  }

  return EMPTY_TWIML;
}

async function processStatusCallback(
  supabase: ReturnType<typeof createServiceRoleClient>,
  params: Record<string, string>,
  businessId: string
) {
  const messageSid = params.MessageSid ?? params.SmsSid;
  const newStatus = STATUS_TO_RECIPIENT_STATUS[params.MessageStatus];
  if (!messageSid || !newStatus) return; // 'queued'/'sending' etc. — nothing to record yet

  const { data: recipient } = await supabase
    .from("campaign_recipients")
    .select("id, business_id, status")
    .eq("provider_message_id", messageSid)
    .maybeSingle();

  if (recipient) {
    if (recipient.business_id !== businessId) return; // cross-tenant mismatch — never apply

    const { error: insertError } = await supabase.from("message_events").insert({
      business_id: recipient.business_id,
      campaign_recipient_id: recipient.id,
      event_type: `sms.${params.MessageStatus}`,
      provider_message_id: messageSid,
      payload: params as unknown as Database["public"]["Tables"]["message_events"]["Insert"]["payload"],
    });
    if (insertError?.code === "23505") return; // duplicate callback, already processed

    const shouldUpdateStatus =
      newStatus === "FAILED" || !RECIPIENT_STATUS_RANK.includes(recipient.status) || RECIPIENT_STATUS_RANK.indexOf(newStatus) >= RECIPIENT_STATUS_RANK.indexOf(recipient.status);

    await supabase
      .from("campaign_recipients")
      .update({
        ...(shouldUpdateStatus ? { status: newStatus } : {}),
        ...(newStatus === "DELIVERED" ? { delivered_at: new Date().toISOString() } : {}),
        ...(newStatus === "FAILED" ? { failed_at: new Date().toISOString(), failure_reason: `${params.ErrorCode ?? ""} ${params.ErrorMessage ?? ""}`.trim().slice(0, 500) } : {}),
      })
      .eq("id", recipient.id);
    return;
  }

  const { data: run } = await supabase
    .from("automation_runs")
    .select("id, business_id, action_result")
    .eq("action_result->>provider_message_id", messageSid)
    .maybeSingle();

  if (run) {
    if (run.business_id !== businessId) return;

    const { error: insertError } = await supabase.from("message_events").insert({
      business_id: run.business_id,
      campaign_recipient_id: null,
      event_type: `sms.${params.MessageStatus}`,
      provider_message_id: messageSid,
      payload: params as unknown as Database["public"]["Tables"]["message_events"]["Insert"]["payload"],
    });
    if (insertError?.code === "23505") return;

    const existingResult = (run.action_result as Record<string, unknown>) ?? {};
    await supabase
      .from("automation_runs")
      .update({
        action_result: { ...existingResult, delivery_status: params.MessageStatus },
        ...(newStatus === "FAILED" ? { status: "FAILED" } : {}),
      })
      .eq("id", run.id);
  }
}

async function processInboundSms(supabase: ReturnType<typeof createServiceRoleClient>, params: Record<string, string>, businessId: string) {
  const messageSid = params.MessageSid ?? params.SmsSid;
  const fromRaw = params.From;
  if (!fromRaw) return;

  const fromNormalized = normalizePhone(fromRaw);
  const optOut = isOptOutText(params.Body);

  let customerId: string | null = null;
  if (fromNormalized.valid) {
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
    channel: "SMS",
    from_address: fromNormalized.valid ? fromNormalized.e164 : fromRaw,
    to_address: params.To ?? null,
    provider_message_id: messageSid ?? null,
    body: params.Body ?? null,
    is_optout: optOut,
    raw_payload: params as unknown as Database["public"]["Tables"]["inbound_messages"]["Insert"]["raw_payload"],
  });

  if (insertError?.code === "23505") return; // duplicate delivery, already processed

  if (optOut && customerId) {
    await supabase.from("customer_consents").upsert(
      {
        business_id: businessId,
        customer_id: customerId,
        channel: "SMS",
        status: "REVOKED",
        revoked_at: new Date().toISOString(),
        source: "SMS_STOP",
      },
      { onConflict: "business_id,customer_id,channel" }
    );
  }
}
