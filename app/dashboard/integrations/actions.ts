"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { ConnectWhatsAppSchema, ConnectTwilioSchema } from "@/lib/validation/integrations";
import { fetchWhatsAppTemplates, type WhatsAppIntegrationConfig } from "@/services/messaging/whatsapp";
import type { SmsIntegrationConfig } from "@/services/messaging/sms";
import type { Database } from "@/lib/supabase/database.types";

export type ActionState = { error?: string; success?: string } | undefined;

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";

/**
 * Completes Meta Embedded Signup (spec item 6: "Correct callback/state flow
 * ... secure server-side credential handling"). Called from
 * components/dashboard/whatsapp-embedded-signup-button.tsx after Meta's JS
 * SDK (`FB.login`) returns an authorization `code` and the
 * `WA_EMBEDDED_SIGNUP` postMessage event delivers the `waba_id`/
 * `phone_number_id` the business owner picked during the flow. The code
 * exchange itself (client_id/client_secret/code → access token) happens
 * here, server-side only — the raw access token is never sent to or held by
 * the browser at any point, same boundary as the manual-entry path below.
 *
 * CODE PATH READY — EXTERNAL META APPROVAL REQUIRED: this has not been
 * exercised against a real Meta app (none exists in this environment; see
 * docs/integrations.md). It cannot be, without a Meta Business/Developer
 * account with WhatsApp Embedded Signup configured and App Review approval
 * for whatsapp_business_management. The manual connect form above is the
 * actually-tested path in this environment.
 */
export async function completeWhatsAppEmbeddedSignup(params: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}): Promise<ActionState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return { error: "WhatsApp Embedded Signup is not configured on this server yet." };
  }

  let accessToken: string;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(params.code)}`
    );
    const body = await res.json();
    if (!res.ok || !body?.access_token) {
      return { error: body?.error?.message ?? "Meta rejected the authorization code." };
    }
    accessToken = body.access_token;
  } catch {
    return { error: "Could not reach Meta to complete the connection." };
  }

  const supabase = await createClient();
  const config: WhatsAppIntegrationConfig = {
    phoneNumberId: params.phoneNumberId,
    wabaId: params.wabaId,
    accessToken,
  };

  const { error } = await supabase.from("business_integrations").upsert(
    {
      business_id: membership.business_id,
      provider: "WHATSAPP",
      status: "CONNECTED",
      config,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "business_id,provider" }
  );

  if (error) return { error: "Could not save the WhatsApp connection." };

  revalidatePath("/dashboard/integrations");
  return { success: "WhatsApp connected via Embedded Signup." };
}

/**
 * Manual WhatsApp connect — see lib/validation/integrations.ts for why this
 * exists alongside Embedded Signup. Writes directly through the
 * authenticated (RLS-checked) client: business_integrations already has an
 * OWNER/MANAGER-only "for all" policy (migration 0008), so no service-role
 * bypass or new RPC is needed here — same pattern as /dashboard/loyalty.
 */
export async function connectWhatsAppManual(_state: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const parsed = ConnectWhatsAppSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the WhatsApp connection details." };
  }

  const supabase = await createClient();
  const config: WhatsAppIntegrationConfig = {
    phoneNumberId: parsed.data.phoneNumberId,
    wabaId: parsed.data.wabaId,
    accessToken: parsed.data.accessToken,
    displayPhoneNumber: parsed.data.displayPhoneNumber,
  };

  const { error } = await supabase.from("business_integrations").upsert(
    {
      business_id: membership.business_id,
      provider: "WHATSAPP",
      status: "CONNECTED",
      config,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "business_id,provider" }
  );

  if (error) return { error: "Could not save the WhatsApp connection." };

  revalidatePath("/dashboard/integrations");
  return { success: "WhatsApp connected." };
}

export async function disconnectWhatsApp(_formData: FormData): Promise<ActionState> {
  void _formData; // required by <form action> shape; nothing to read from it
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_integrations")
    .update({ status: "NOT_CONNECTED", config: {}, connected_at: null })
    .eq("business_id", membership.business_id)
    .eq("provider", "WHATSAPP");

  if (error) return { error: "Could not disconnect WhatsApp." };
  revalidatePath("/dashboard/integrations");
  return { success: "WhatsApp disconnected." };
}

export async function connectTwilio(_state: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const parsed = ConnectTwilioSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the Twilio connection details." };
  }

  const supabase = await createClient();
  const config: SmsIntegrationConfig = parsed.data;

  const { error } = await supabase.from("business_integrations").upsert(
    {
      business_id: membership.business_id,
      provider: "SMS_TWILIO",
      status: "CONNECTED",
      config,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "business_id,provider" }
  );

  if (error) return { error: "Could not save the Twilio connection." };

  revalidatePath("/dashboard/integrations");
  return { success: "Twilio connected." };
}

export async function disconnectTwilio(_formData: FormData): Promise<ActionState> {
  void _formData; // required by <form action> shape; nothing to read from it
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_integrations")
    .update({ status: "NOT_CONNECTED", config: {}, connected_at: null })
    .eq("business_id", membership.business_id)
    .eq("provider", "SMS_TWILIO");

  if (error) return { error: "Could not disconnect Twilio." };
  revalidatePath("/dashboard/integrations");
  return { success: "Twilio disconnected." };
}

/**
 * [ SYNC TEMPLATES ] — real Graph API request path, config-gated. With no
 * WABA connected this returns an error rather than fake template rows (Part:
 * "do not fake successful synchronization").
 */
export async function syncWhatsAppTemplates(_formData: FormData): Promise<ActionState> {
  void _formData; // required by <form action> shape; nothing to read from it
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const supabase = await createClient();

  const { data: integration } = await supabase
    .from("business_integrations")
    .select("config, status")
    .eq("business_id", membership.business_id)
    .eq("provider", "WHATSAPP")
    .maybeSingle();

  if (integration?.status !== "CONNECTED") {
    return { error: "Connect WhatsApp before syncing templates." };
  }

  let templates;
  try {
    templates = await fetchWhatsAppTemplates(integration.config as Partial<WhatsAppIntegrationConfig>);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Template sync failed." };
  }

  const now = new Date().toISOString();
  for (const template of templates) {
    await supabase.from("message_templates").upsert(
      {
        business_id: membership.business_id,
        provider_template_id: template.id,
        name: template.name,
        channel: "WHATSAPP",
        language: template.language,
        category: template.category,
        status: template.status,
        content: template.components.find((c) => c.type === "BODY")?.text ?? "",
        components: template.components as unknown as Database["public"]["Tables"]["message_templates"]["Insert"]["components"],
        last_synced_at: now,
      },
      { onConflict: "business_id,provider_template_id" }
    );
  }

  revalidatePath("/dashboard/integrations");
  return { success: `Synced ${templates.length} template${templates.length === 1 ? "" : "s"}.` };
}
