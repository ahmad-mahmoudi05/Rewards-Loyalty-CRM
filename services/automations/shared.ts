import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { renderTemplate, type TemplateContext } from "@/services/messaging/render-template";
import { renderEmailHtml } from "@/services/messaging/email-template";
import { sendEmail } from "@/services/messaging/email";
import { sendWhatsAppTemplate, type WhatsAppIntegrationConfig } from "@/services/messaging/whatsapp";
import { sendSms, type SmsIntegrationConfig } from "@/services/messaging/sms";
import { ProviderNotConnectedError } from "@/services/messaging/types";
import { getSiteUrl } from "@/lib/site-url";

type Business = Database["public"]["Tables"]["businesses"]["Row"];
type CustomerSummary = Database["public"]["Views"]["customer_summary"]["Row"];
type Channel = "EMAIL" | "WHATSAPP" | "SMS";

const STUCK_RUN_TIMEOUT_MS = 10 * 60_000;

/**
 * Atomically claims the right to run this automation for this
 * customer/dedupe-key combination. The unique(automation_id, customer_id,
 * dedupe_key) constraint (migration 0005) does the actual work — this is
 * "insert first, ask permission never" rather than "check then insert",
 * which is what makes concurrent scheduler runs safe (Part 56/74/75).
 * Returns null if this exact run already exists (already handled, skip).
 *
 * Stuck-job recovery: sendAutomationMessage is what eventually flips this
 * row from QUEUED to SENT/SKIPPED/FAILED. If the process crashes between
 * this insert and that update, the row is stuck at QUEUED forever — and
 * because the unique constraint is what "already handled" means here, that
 * customer could NEVER be retried for this exact dedupe key again, unlike
 * the campaign queue's SENDING rows (which at least get reclaimed, see
 * migration 0026). Fixed by clearing a stale QUEUED row for this exact key
 * before attempting the insert, so a genuinely stuck run gets one more
 * attempt on the next scheduler tick instead of being silently lost.
 */
export async function claimAutomationRun(
  supabase: SupabaseClient<Database>,
  params: { automationId: string; businessId: string; customerId: string; dedupeKey: string; triggerEntityId?: string }
): Promise<string | null> {
  await supabase
    .from("automation_runs")
    .delete()
    .eq("automation_id", params.automationId)
    .eq("customer_id", params.customerId)
    .eq("dedupe_key", params.dedupeKey)
    .eq("status", "QUEUED")
    .lt("triggered_at", new Date(Date.now() - STUCK_RUN_TIMEOUT_MS).toISOString());

  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      automation_id: params.automationId,
      business_id: params.businessId,
      customer_id: params.customerId,
      dedupe_key: params.dedupeKey,
      trigger_entity_id: params.triggerEntityId ?? null,
      status: "QUEUED",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data.id;
}

/** Checks consent (re-checked here, at the moment of send — Part 58/re-check
 * requirements), renders the message, dispatches on the given channel, and
 * records the outcome on the automation_runs row this run already claimed. */
export async function sendAutomationMessage(
  supabase: SupabaseClient<Database>,
  params: {
    runId: string;
    business: Business;
    customer: CustomerSummary;
    channel: Channel;
    message: string;
    context: TemplateContext;
  }
): Promise<{ sent: boolean; reason?: string }> {
  const { data: consent } = await supabase
    .from("customer_consents")
    .select("status")
    .eq("customer_id", params.customer.id!)
    .eq("channel", params.channel)
    .maybeSingle();

  if (!consent || consent.status !== "GRANTED") {
    await supabase
      .from("automation_runs")
      .update({ status: "SKIPPED", action_result: { reason: "no_consent" } })
      .eq("id", params.runId);
    return { sent: false, reason: "no_consent" };
  }

  const rendered = renderTemplate(params.message, params.context);
  let result: { success: boolean; providerMessageId?: string; error?: string };

  try {
    if (params.channel === "EMAIL") {
      if (!params.customer.email) throw new Error("Customer has no email address.");
      const siteUrl = await getSiteUrl();
      const { data: branding } = await supabase
        .from("business_branding")
        .select("*")
        .eq("business_id", params.business.id)
        .maybeSingle();
      const unsubscribeUrl = `${siteUrl}/unsubscribe/${params.customer.unsubscribe_token}`;
      result = await sendEmail({
        to: params.customer.email,
        subject: params.business.name,
        html: renderEmailHtml({ business: params.business, branding, bodyText: rendered, unsubscribeUrl }),
        text: `${rendered}\n\nUnsubscribe: ${unsubscribeUrl}`,
        fromName: params.business.name,
        unsubscribeUrl,
        idempotencyKey: params.runId,
      });
    } else if (params.channel === "WHATSAPP") {
      if (!params.customer.phone_normalized) throw new Error("Customer has no phone number.");
      const { data: integration } = await supabase
        .from("business_integrations")
        .select("*")
        .eq("business_id", params.business.id)
        .eq("provider", "WHATSAPP")
        .maybeSingle();
      result = await sendWhatsAppTemplate({
        config: integration?.status === "CONNECTED" ? (integration.config as WhatsAppIntegrationConfig) : null,
        to: params.customer.phone_normalized,
        // Same fixed-name limitation as services/campaigns/process.ts — a
        // real WABA must have an approved template named exactly
        // "automation_message". See docs/integrations.md.
        templateName: "automation_message",
        languageCode: "en",
        parameters: [rendered],
        idempotencyKey: params.runId,
      });
    } else {
      if (!params.customer.phone_normalized) throw new Error("Customer has no phone number.");
      const { data: integration } = await supabase
        .from("business_integrations")
        .select("*")
        .eq("business_id", params.business.id)
        .eq("provider", "SMS_TWILIO")
        .maybeSingle();
      result = await sendSms({
        config: integration?.status === "CONNECTED" ? (integration.config as SmsIntegrationConfig) : null,
        to: params.customer.phone_normalized,
        body: rendered,
        idempotencyKey: params.runId,
      });
    }
  } catch (err) {
    result = {
      success: false,
      error: err instanceof ProviderNotConnectedError ? err.message : err instanceof Error ? err.message : "Unknown error.",
    };
  }

  await supabase
    .from("automation_runs")
    .update({
      status: result.success ? "SENT" : "FAILED",
      message_id: result.success ? null : null,
      action_result: result.success ? { provider_message_id: result.providerMessageId } : { error: result.error },
    })
    .eq("id", params.runId);

  return { sent: result.success, reason: result.success ? undefined : result.error };
}

export async function addSystemTag(supabase: SupabaseClient<Database>, businessId: string, customerId: string, tagName: "AT_RISK" | "VIP") {
  const { data: tagId } = await supabase.rpc("ensure_system_tag", { p_business_id: businessId, p_name: tagName });
  if (tagId) {
    await supabase.from("customer_tags").upsert({ customer_id: customerId, tag_id: tagId }, { onConflict: "customer_id,tag_id" });
  }
}

export async function removeSystemTag(supabase: SupabaseClient<Database>, businessId: string, customerId: string, tagName: string) {
  const { data: tag } = await supabase.from("tags").select("id").eq("business_id", businessId).eq("name", tagName).maybeSingle();
  if (tag) {
    await supabase.from("customer_tags").delete().eq("customer_id", customerId).eq("tag_id", tag.id);
  }
}
