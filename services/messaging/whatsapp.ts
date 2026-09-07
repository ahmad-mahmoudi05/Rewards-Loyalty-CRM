import "server-only";
import { ProviderNotConnectedError, type SendMessageResult } from "./types";

/**
 * Meta WhatsApp Business Platform, Cloud API. CODE COMPLETE / META APP REVIEW
 * PENDING — see docs/integrations.md for exact permissions, Embedded Signup
 * steps, and why nothing here has been sent against a real WABA.
 *
 * The API version is a single constant, not hard-coded per call site —
 * bump it here when Meta deprecates the current one. **Verify this against
 * Meta's current Graph API changelog before relying on it in production**;
 * it was not possible to browse Meta's live docs while writing this, so
 * treat the default below as a reasonable-as-of-training-data placeholder,
 * not a verified-current value.
 */
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";

export type WhatsAppIntegrationConfig = {
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
  displayPhoneNumber?: string;
};

export function isWhatsAppConfigured(config: Partial<WhatsAppIntegrationConfig> | null | undefined): config is WhatsAppIntegrationConfig {
  return Boolean(config?.phoneNumberId && config?.accessToken);
}

/**
 * Sends a pre-approved template message — the only kind of business-
 * initiated WhatsApp marketing message Meta allows outside a 24-hour
 * customer-service window. `parameters` fill the template's `{{1}}`,
 * `{{2}}`, ... body placeholders in order, already rendered server-side
 * (see services/messaging/render-template.ts) — nothing here evaluates
 * merchant input as code.
 */
export async function sendWhatsAppTemplate(params: {
  config: Partial<WhatsAppIntegrationConfig> | null | undefined;
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
  idempotencyKey: string;
}): Promise<SendMessageResult> {
  if (!isWhatsAppConfigured(params.config)) {
    throw new ProviderNotConnectedError("WHATSAPP");
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${params.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: params.to,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: params.languageCode },
            components: params.parameters.length
              ? [
                  {
                    type: "body",
                    parameters: params.parameters.map((text) => ({ type: "text", text })),
                  },
                ]
              : [],
          },
        }),
      }
    );

    const body = await res.json();

    if (!res.ok) {
      // Meta error codes: 4xx auth/permission/template issues are permanent;
      // 429 and 5xx are transient. See Meta's Cloud API error reference.
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
      return { success: false, error: body?.error?.message ?? `HTTP ${res.status}`, permanent };
    }

    const providerMessageId = body?.messages?.[0]?.id;
    if (!providerMessageId) {
      return { success: false, error: "No message id returned by provider.", permanent: false };
    }
    return { success: true, providerMessageId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error.", permanent: false };
  }
}
