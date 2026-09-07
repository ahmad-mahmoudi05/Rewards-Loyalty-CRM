import "server-only";
import { Resend } from "resend";
import type { SendMessageResult } from "./types";

let client: Resend | null = null;
function getResend() {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

/**
 * Resend sandbox reality (no verified sending domain configured yet — see
 * docs/integrations.md): every send goes out as `onboarding@resend.dev` and
 * Resend will only actually deliver it to the email address the Resend
 * account itself was signed up with. Personalized "from name" still shows
 * the business, since that's just a display header, not the underlying
 * verified sender — a verified custom/shared domain is what production
 * needs, and is exactly the piece this sandbox doesn't have.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  replyTo?: string;
  unsubscribeUrl?: string;
  idempotencyKey: string;
}): Promise<SendMessageResult> {
  const resend = getResend();

  const headers: Record<string, string> = {};
  if (params.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${params.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const { data, error } = await resend.emails.send(
    {
      from: `${params.fromName} <onboarding@resend.dev>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      headers,
    },
    { idempotencyKey: params.idempotencyKey }
  );

  if (error) {
    const permanent = [
      "validation_error",
      "invalid_parameter",
      "invalid_from_address",
      "missing_required_field",
      "invalid_api_key",
      "restricted_api_key",
    ].includes(error.name);
    return { success: false, error: error.message, permanent };
  }

  return { success: true, providerMessageId: data.id };
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}
