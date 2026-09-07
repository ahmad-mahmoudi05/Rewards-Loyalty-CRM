import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { sendEmail } from "@/services/messaging/email";
import { sendWhatsAppTemplate, type WhatsAppIntegrationConfig } from "@/services/messaging/whatsapp";
import { sendSms, type SmsIntegrationConfig } from "@/services/messaging/sms";
import { ProviderNotConnectedError } from "@/services/messaging/types";
import { renderTemplate, type TemplateContext } from "@/services/messaging/render-template";
import { renderEmailHtml } from "@/services/messaging/email-template";
import { getSiteUrl } from "@/lib/site-url";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;

function backoffMinutes(attempt: number) {
  return Math.min(2 ** attempt, 60); // 2, 4, 8, 16, 32, capped at 60 minutes
}

/**
 * Processes one batch of due campaign_recipients across every business.
 * Safe to call concurrently (claim_queued_recipients uses FOR UPDATE SKIP
 * LOCKED) and safe to call redundantly (an immediate post-send `after()`
 * trigger racing a cron tick) — a recipient can only ever be claimed once
 * per attempt. Returns a summary for logging/testing, never throws for a
 * single recipient's failure (that recipient is marked FAILED/retried
 * instead — one bad recipient must never abort the batch).
 */
export async function processQueuedCampaigns() {
  const supabase = createServiceRoleClient();
  const siteUrl = await getSiteUrl();

  const { data: claimed, error: claimError } = await supabase.rpc("claim_queued_recipients", { p_limit: BATCH_SIZE });
  if (claimError) {
    return { claimed: 0, sent: 0, failed: 0, skipped: 0, error: claimError.message };
  }

  const recipients = claimed ?? [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const touchedCampaignIds = new Set<string>();

  for (const recipient of recipients) {
    touchedCampaignIds.add(recipient.campaign_id);

    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", recipient.campaign_id).single();
    if (!campaign) {
      failed++;
      continue;
    }

    // Re-check consent immediately before dispatch (Part 10) — it may have
    // been revoked after the recipient was snapshotted.
    const { data: consent } = await supabase
      .from("customer_consents")
      .select("status")
      .eq("customer_id", recipient.customer_id)
      .eq("channel", campaign.channel)
      .maybeSingle();

    if (!consent || consent.status !== "GRANTED") {
      await supabase
        .from("campaign_recipients")
        .update({ status: "SKIPPED_NO_CONSENT" })
        .eq("id", recipient.id);
      skipped++;
      continue;
    }

    const { data: customer } = await supabase
      .from("customer_summary")
      .select("*")
      .eq("id", recipient.customer_id)
      .single();
    const { data: business } = await supabase.from("businesses").select("*").eq("id", recipient.business_id).single();
    const { data: branding } = await supabase
      .from("business_branding")
      .select("*")
      .eq("business_id", recipient.business_id)
      .maybeSingle();

    if (!customer || !business) {
      await supabase.from("campaign_recipients").update({ status: "SKIPPED_INVALID_ADDRESS" }).eq("id", recipient.id);
      skipped++;
      continue;
    }

    const remaining =
      customer.loyalty_type === "STAMPS"
        ? Math.max((customer.stamp_required_count ?? 0) - (customer.stamps_count ?? 0), 0)
        : customer.loyalty_type === "POINTS"
          ? Math.max((customer.points_reward_threshold ?? 0) - (customer.points_balance ?? 0), 0)
          : undefined;

    const { data: offer } = await supabase
      .from("customer_offers")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("customer_id", recipient.customer_id)
      .maybeSingle();

    const context: TemplateContext = {
      first_name: customer.first_name ?? "there",
      business_name: business.name,
      points: customer.points_balance ?? undefined,
      stamps: customer.stamps_count ?? undefined,
      remaining,
      reward_name: campaign.offer_description ?? undefined,
      offer: campaign.offer_type ? describeOffer(campaign.offer_type, campaign.offer_value) : undefined,
      expiry: offer?.expires_at ? new Date(offer.expires_at).toLocaleDateString() : undefined,
    };

    const renderedMessage = renderTemplate(campaign.message_body ?? "", context);

    let result;
    try {
      if (campaign.channel === "EMAIL") {
        const unsubscribeUrl = `${siteUrl}/unsubscribe/${customer.unsubscribe_token}`;
        result = await sendEmail({
          to: recipient.channel_address,
          subject: renderTemplate(campaign.name, context),
          html: renderEmailHtml({ business, branding, bodyText: renderedMessage, unsubscribeUrl }),
          text: `${renderedMessage}\n\nUnsubscribe: ${unsubscribeUrl}`,
          fromName: business.name,
          unsubscribeUrl,
          idempotencyKey: recipient.id,
        });
      } else if (campaign.channel === "WHATSAPP") {
        const { data: integration } = await supabase
          .from("business_integrations")
          .select("*")
          .eq("business_id", recipient.business_id)
          .eq("provider", "WHATSAPP")
          .maybeSingle();
        result = await sendWhatsAppTemplate({
          config: integration?.status === "CONNECTED" ? (integration.config as WhatsAppIntegrationConfig) : null,
          to: recipient.channel_address,
          // Fixed name, not the business's actually-synced template (see
          // message_templates / "Sync templates" on /dashboard/integrations)
          // — v1 doesn't offer per-campaign template selection. A real WABA
          // must have an approved template named exactly "marketing_message"
          // for campaign sends to succeed; documented as an explicit external
          // setup requirement in docs/integrations.md, not left as a silent
          // assumption.
          templateName: "marketing_message",
          languageCode: "en",
          parameters: [renderedMessage],
          idempotencyKey: recipient.id,
        });
      } else {
        const { data: integration } = await supabase
          .from("business_integrations")
          .select("*")
          .eq("business_id", recipient.business_id)
          .eq("provider", "SMS_TWILIO")
          .maybeSingle();
        result = await sendSms({
          config: integration?.status === "CONNECTED" ? (integration.config as SmsIntegrationConfig) : null,
          to: recipient.channel_address,
          body: renderedMessage,
          idempotencyKey: recipient.id,
        });
      }
    } catch (err) {
      if (err instanceof ProviderNotConnectedError) {
        result = { success: false as const, error: err.message, permanent: true };
      } else {
        result = { success: false as const, error: err instanceof Error ? err.message : "Unknown error.", permanent: false };
      }
    }

    if (result.success) {
      await supabase
        .from("campaign_recipients")
        .update({ status: "SENT", sent_at: new Date().toISOString(), provider_message_id: result.providerMessageId })
        .eq("id", recipient.id);
      await supabase.from("message_events").insert({
        business_id: recipient.business_id,
        campaign_recipient_id: recipient.id,
        event_type: "sent",
        provider_message_id: result.providerMessageId,
        payload: {},
      });
      sent++;
    } else if (result.permanent || recipient.attempt_count >= MAX_ATTEMPTS) {
      await supabase
        .from("campaign_recipients")
        .update({ status: "FAILED", failed_at: new Date().toISOString(), failure_reason: result.error })
        .eq("id", recipient.id);
      failed++;
    } else {
      await supabase
        .from("campaign_recipients")
        .update({
          status: "QUEUED",
          next_attempt_at: new Date(Date.now() + backoffMinutes(recipient.attempt_count) * 60_000).toISOString(),
          failure_reason: result.error,
        })
        .eq("id", recipient.id);
    }
  }

  for (const campaignId of touchedCampaignIds) {
    await supabase.rpc("finalize_campaign_if_complete", { p_campaign_id: campaignId });
  }

  return { claimed: recipients.length, sent, failed, skipped };
}

function describeOffer(offerType: string, value: number | null) {
  switch (offerType) {
    case "PERCENT_DISCOUNT":
      return `${value}% off`;
    case "FIXED_DISCOUNT":
      return `${value} off`;
    case "FREE_ITEM":
      return "a free item";
    case "BONUS_POINTS":
      return `${value} bonus points`;
    case "BONUS_STAMP":
      return `a bonus stamp`;
    default:
      return "a reward";
  }
}
