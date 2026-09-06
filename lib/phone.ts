import { parsePhoneNumberWithError, ParseError } from "libphonenumber-js";

export type NormalizedPhone = { valid: true; e164: string } | { valid: false; error: string };

/**
 * Normalizes a phone number to E.164 for identity/uniqueness purposes
 * (business_id + phone_normalized). Defaults to the UAE (+971) when the
 * input has no country code, since that's the launch market — but any
 * number with an explicit country code (leading `+` or `00`) parses
 * internationally. See docs/database.md for why identity is scoped per
 * business rather than globally.
 */
export function normalizePhone(raw: string, defaultCountry: "AE" = "AE"): NormalizedPhone {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: "Enter a phone number." };
  }

  try {
    const parsed = parsePhoneNumberWithError(trimmed, defaultCountry);
    if (!parsed.isValid()) {
      return { valid: false, error: "Enter a valid phone number." };
    }
    return { valid: true, e164: parsed.number };
  } catch (error) {
    if (error instanceof ParseError) {
      return { valid: false, error: "Enter a valid phone number." };
    }
    throw error;
  }
}
