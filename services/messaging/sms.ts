import "server-only";
import twilio from "twilio";
import { ProviderNotConnectedError, type SendMessageResult } from "./types";

/**
 * Twilio SMS. CODE COMPLETE / UAE SENDER REGISTRATION PENDING — see
 * docs/integrations.md. The UAE (our launch market) requires a registered
 * Sender ID / approved originator for commercial SMS; an unregistered
 * generic Twilio long-code number is not guaranteed to deliver to UAE
 * handsets reliably and may be filtered by local carriers. That approval
 * is external and per-business; nothing here is blocked on it beyond the
 * actual send.
 */

export type SmsIntegrationConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

export function isSmsConfigured(config: Partial<SmsIntegrationConfig> | null | undefined): config is SmsIntegrationConfig {
  return Boolean(config?.accountSid && config?.authToken && config?.fromNumber);
}

export async function sendSms(params: {
  config: Partial<SmsIntegrationConfig> | null | undefined;
  to: string;
  body: string;
  idempotencyKey: string;
}): Promise<SendMessageResult> {
  if (!isSmsConfigured(params.config)) {
    throw new ProviderNotConnectedError("SMS");
  }

  const client = twilio(params.config.accountSid, params.config.authToken);

  try {
    const message = await client.messages.create({
      to: params.to,
      from: params.config.fromNumber,
      body: params.body,
      // Twilio's own idempotency mechanism for the Messages resource.
      statusCallback: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`
        : undefined,
    });

    return { success: true, providerMessageId: message.sid };
  } catch (err) {
    const twilioError = err as { code?: number; status?: number; message?: string };
    // Twilio error codes 21211 (invalid number), 21610 (unsubscribed),
    // 21408 (permission/region) etc. are permanent; 429/5xx are transient.
    const permanent = typeof twilioError.status === "number" && twilioError.status < 500 && twilioError.status !== 429;
    return {
      success: false,
      error: twilioError.message ?? "Twilio send failed.",
      permanent,
    };
  }
}
