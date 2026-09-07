import { z } from "zod";

/**
 * Manual WhatsApp connection form. The primary, spec-preferred path is Meta
 * Embedded Signup (see components/dashboard/whatsapp-embedded-signup-button.tsx
 * + app/api/integrations/whatsapp/callback/route.ts) — but that requires a
 * real Meta app + App Review, neither of which exist in this environment
 * (see docs/integrations.md). This manual form is the fallback that makes
 * the rest of Day 4.5 (opt-out, template sync, webhooks) genuinely testable
 * against a real WABA without waiting on Embedded Signup, and doubles as the
 * real production path for a business that already has these values from
 * Meta's Business Manager some other way.
 */
export const ConnectWhatsAppSchema = z.object({
  phoneNumberId: z.string().trim().min(1, "Phone number ID is required."),
  wabaId: z.string().trim().min(1, "WhatsApp Business Account ID is required."),
  accessToken: z.string().trim().min(1, "Access token is required."),
  displayPhoneNumber: z.string().trim().optional(),
});

export const ConnectTwilioSchema = z.object({
  accountSid: z
    .string()
    .trim()
    .regex(/^AC[a-zA-Z0-9]{32}$/, "Account SID should look like ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx."),
  authToken: z.string().trim().min(1, "Auth token is required."),
  fromNumber: z.string().trim().min(1, "Sender number is required."),
});
