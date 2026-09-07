import { z } from "zod";
import { BUSINESS_TYPES } from "./onboarding";

export const UpdateBusinessSettingsSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name."),
  businessType: z.enum(BUSINESS_TYPES.map((t) => t.value) as [string, ...string[]]),
  country: z.string().trim().min(2, "Enter a 2-letter country code.").max(2),
  currency: z.string().trim().length(3, "Enter a 3-letter currency code."),
  timezone: z.string().trim().min(1, "Enter a timezone."),
});
