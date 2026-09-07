import { z } from "zod";

// Strict hex-only validation matters here beyond form UX: these values are
// interpolated directly into inline `style` attributes in outbound campaign
// email HTML (services/messaging/email-template.ts) with no further
// escaping — see docs/progress.md "Session 7" for the audit finding this
// closes. Rejecting anything that isn't exactly `#rrggbb` at the boundary
// means nothing else downstream needs to re-validate or escape it.
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const hexColor = (label: string) => z.string().trim().regex(HEX_COLOR, `${label} must be a hex color like #171717.`);

export const BUTTON_STYLES = ["rounded", "pill", "square"] as const;

export const UpdateBrandingSchema = z.object({
  logoUrl: z.union([z.string().trim().url("Enter a valid logo URL."), z.literal("")]).optional(),
  primaryColor: hexColor("Primary color"),
  secondaryColor: z.union([hexColor("Secondary color"), z.literal("")]).optional(),
  backgroundColor: hexColor("Background color"),
  textColor: hexColor("Text color"),
  buttonStyle: z.enum(BUTTON_STYLES),
});
