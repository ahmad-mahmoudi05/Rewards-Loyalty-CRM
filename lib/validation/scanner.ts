import { z } from "zod";

const UuidSchema = z.uuid();

/**
 * Scanned QR text is untrusted input (Part 35). It's expected to be either
 * a bare wallet_token UUID or a `.../q/<token>` URL — anything else (an
 * arbitrary URL, garbage data, an oversized payload) is rejected before it
 * ever reaches a query. This never navigates anywhere with the scanned
 * text; it only ever extracts a token to look up server-side.
 */
export function parseScannedToken(raw: string): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) {
    return null;
  }

  const trimmed = raw.trim();
  const candidate = trimmed.includes("/") ? trimmed.split(/[/?#]/).filter(Boolean).pop() : trimmed;

  const result = UuidSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

export const SearchCustomersSchema = z.object({
  query: z.string().trim().min(2, "Enter at least 2 characters.").max(100),
});
