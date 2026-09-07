import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ProviderNotConnectedError, type SendMessageResult } from "./types";
import { mapMetaTemplatesPage, nextPageUrl, type MetaTemplate } from "./whatsapp-template-mapping";

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

  // Same note as services/messaging/sms.ts: `idempotencyKey` isn't
  // forwarded to Meta's Cloud API below (its template-message endpoint has
  // no idempotency-key parameter either) — protection against a double-send
  // is the same upstream claim-once-then-timeout-reclaim mechanism, not
  // this call. See sms.ts for the full explanation; not repeated at every
  // call site.
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

/**
 * Verifies Meta's `X-Hub-Signature-256` header (`sha256=<hex hmac>` over the
 * *raw* request body, keyed by the app secret — Meta's documented webhook
 * signing method, same shape as every Graph API webhook, not just
 * WhatsApp). Must run against the raw body text, before JSON.parse, exactly
 * like the Resend/svix verification in app/api/webhooks/resend/route.ts.
 * `timingSafeEqual` avoids a timing side-channel on the comparison; lengths
 * are checked first since `timingSafeEqual` throws on mismatched buffer
 * lengths rather than returning false.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export type { MetaTemplate, MetaTemplateComponent } from "./whatsapp-template-mapping";

/**
 * Fetches every message template on a connected WABA. Real request path,
 * config-gated exactly like sendWhatsAppTemplate — with no credentials this
 * throws ProviderNotConnectedError rather than returning fake data (Part:
 * "do not fake successful synchronization"). Paginates via Meta's
 * `paging.next` cursor URL; capped at 20 pages (2000 templates at the
 * default page size) as a sane worst-case bound, not a real-world limit.
 * The actual parsing/mapping is in whatsapp-template-mapping.ts, kept free
 * of "server-only"/network code specifically so it can be exercised with a
 * fixture in isolation — see scripts/tmp-day45-webhook-test.mjs.
 */
export async function fetchWhatsAppTemplates(
  config: Partial<WhatsAppIntegrationConfig> | null | undefined
): Promise<MetaTemplate[]> {
  if (!isWhatsAppConfigured(config) || !config.wabaId) {
    throw new ProviderNotConnectedError("WHATSAPP");
  }

  const templates: MetaTemplate[] = [];
  let url: string | undefined =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.wabaId}/message_templates?fields=id,name,language,category,status,components&limit=100`;

  for (let page = 0; url && page < 20; page++) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error?.message ?? `Meta template sync failed with HTTP ${res.status}`);
    }
    templates.push(...mapMetaTemplatesPage(body));
    url = nextPageUrl(body);
  }

  return templates;
}
