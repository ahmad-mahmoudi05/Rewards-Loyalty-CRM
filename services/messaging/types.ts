import "server-only";

export type MessageChannel = "EMAIL" | "WHATSAPP" | "SMS";

export type SendMessageResult =
  | { success: true; providerMessageId: string }
  | { success: false; error: string; permanent: boolean };

/** Thrown by a provider adapter when its business_integrations row isn't
 * CONNECTED yet — callers turn this into the exact "not connected" UX
 * (Part 79), never a raw provider error. */
export class ProviderNotConnectedError extends Error {
  constructor(public channel: MessageChannel) {
    super(`${channel} is not connected for this business.`);
  }
}
