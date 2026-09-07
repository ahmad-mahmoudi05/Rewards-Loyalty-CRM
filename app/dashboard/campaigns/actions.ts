"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { CreateCampaignSchema, TestSendSchema } from "@/lib/validation/campaign";
import { fetchSegmentCustomers, summarizeAudience, type AudienceDefinition } from "@/services/campaigns/segments";
import { processQueuedCampaigns } from "@/services/campaigns/process";
import { sendEmail } from "@/services/messaging/email";
import { renderEmailHtml } from "@/services/messaging/email-template";
import { renderTemplate, SAMPLE_PREVIEW_CONTEXT } from "@/services/messaging/render-template";
import { getEntitlements, billingGateMessage } from "@/lib/entitlements";

export type CreateCampaignState = { error?: string } | undefined;

export async function createCampaign(_state: CreateCampaignState, formData: FormData): Promise<CreateCampaignState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);

  const parsed = CreateCampaignSchema.safeParse({
    name: formData.get("name"),
    channel: formData.get("channel"),
    segment: formData.get("segment"),
    spendThreshold: formData.get("spendThreshold") || undefined,
    visitThreshold: formData.get("visitThreshold") || undefined,
    subject: formData.get("subject") || undefined,
    message: formData.get("message"),
    scheduledAt: formData.get("scheduledAt") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form for errors." };
  }

  const supabase = await createClient();

  const entitlements = await getEntitlements(supabase, membership.business_id);
  const gateMessage = billingGateMessage(entitlements);
  if (gateMessage) return { error: gateMessage };

  if (parsed.data.channel !== "EMAIL") {
    const label = parsed.data.channel === "WHATSAPP" ? "WhatsApp" : "SMS";
    const channelEntitled = parsed.data.channel === "WHATSAPP" ? entitlements.whatsappEnabled : entitlements.smsEnabled;
    if (!channelEntitled) {
      return { error: `${label} campaigns aren't included in your ${entitlements.planName} plan. Upgrade in Billing.` };
    }

    const provider = parsed.data.channel === "WHATSAPP" ? "WHATSAPP" : "SMS_TWILIO";
    const { data: integration } = await supabase
      .from("business_integrations")
      .select("status")
      .eq("business_id", membership.business_id)
      .eq("provider", provider)
      .maybeSingle();
    if (integration?.status !== "CONNECTED") {
      return { error: `Connect your ${label} account before sending ${label} campaigns.` };
    }
  } else if (!entitlements.emailEnabled) {
    return { error: `Email campaigns aren't included in your ${entitlements.planName} plan. Upgrade in Billing.` };
  }

  const { data: campaign, error: createError } = await supabase
    .from("campaigns")
    .insert({
      business_id: membership.business_id,
      name: parsed.data.name,
      channel: parsed.data.channel,
      audience_definition: {
        segment: parsed.data.segment,
        spendThreshold: parsed.data.spendThreshold,
        visitThreshold: parsed.data.visitThreshold,
      },
      message_body: parsed.data.message,
      scheduled_at: parsed.data.scheduledAt || null,
      created_by: membership.profile_id,
    })
    .select("id")
    .single();

  if (createError || !campaign) {
    return { error: "Could not create the campaign. Please try again." };
  }

  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/campaigns/${campaign.id}`);
}

export type SendCampaignState = { error?: string; success?: boolean } | undefined;

export async function sendCampaign(campaignId: string): Promise<SendCampaignState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const supabase = await createClient();

  const entitlements = await getEntitlements(supabase, membership.business_id);
  const gateMessage = billingGateMessage(entitlements);
  if (gateMessage) return { error: gateMessage };

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", membership.business_id)
    .maybeSingle();

  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status !== "DRAFT") return { error: "This campaign has already been sent or scheduled." };

  const audience: AudienceDefinition = {
    segment: (campaign.audience_definition as { segment: AudienceDefinition["segment"] }).segment,
    spendThreshold: (campaign.audience_definition as { spendThreshold?: number })?.spendThreshold,
    visitThreshold: (campaign.audience_definition as { visitThreshold?: number })?.visitThreshold,
  };

  const rows = await fetchSegmentCustomers(supabase, membership.business_id, audience);
  const preview = summarizeAudience(rows, campaign.channel as "EMAIL" | "WHATSAPP" | "SMS");

  if (preview.eligibleCustomerIds.length === 0) {
    return { error: "0 customers are eligible for this campaign." };
  }

  const { error: snapshotError } = await supabase.rpc("snapshot_campaign_recipients", {
    p_business_id: membership.business_id,
    p_campaign_id: campaignId,
    p_customer_ids: preview.eligibleCustomerIds,
  });

  if (snapshotError) {
    return { error: snapshotError.message || "Could not queue this campaign." };
  }

  after(() => processQueuedCampaigns());

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath("/dashboard/campaigns");
  return { success: true };
}

export type TestSendState = { error?: string; success?: boolean } | undefined;

export async function sendTestEmail(_state: TestSendState, formData: FormData): Promise<TestSendState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);

  const parsed = TestSendSchema.safeParse({
    campaignId: formData.get("campaignId"),
    destination: formData.get("destination"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid destination." };
  }

  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, business:businesses(*)")
    .eq("id", parsed.data.campaignId)
    .eq("business_id", membership.business_id)
    .maybeSingle();

  if (!campaign) return { error: "Campaign not found." };
  if (campaign.channel !== "EMAIL") {
    return { error: "Test send is only available for Email today." };
  }

  const { data: branding } = await supabase
    .from("business_branding")
    .select("*")
    .eq("business_id", membership.business_id)
    .maybeSingle();

  const message = renderTemplate(campaign.message_body ?? "", SAMPLE_PREVIEW_CONTEXT);
  const result = await sendEmail({
    to: parsed.data.destination,
    subject: `[TEST] ${renderTemplate(campaign.name, SAMPLE_PREVIEW_CONTEXT)}`,
    html: renderEmailHtml({
      business: campaign.business!,
      branding,
      bodyText: message,
      unsubscribeUrl: "#",
    }),
    text: message,
    fromName: campaign.business?.name ?? "LoyalNest",
    idempotencyKey: `test-${parsed.data.campaignId}-${Date.now()}`,
  });

  if (!result.success) {
    return { error: result.error };
  }
  return { success: true };
}
