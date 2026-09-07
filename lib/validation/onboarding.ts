import { z } from "zod";

export const BUSINESS_TYPES = [
  { value: "COFFEE_SHOP", label: "Coffee shop" },
  { value: "PADEL", label: "Padel club" },
  { value: "BARBER", label: "Barber" },
  { value: "SALON", label: "Salon" },
  { value: "GYM", label: "Gym / fitness studio" },
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "OTHER", label: "Other" },
] as const;

export const PLAN_CHOICES = [
  { code: "STARTER", label: "Starter", blurb: "1 location, up to 3 staff, email campaigns." },
  { code: "GROWTH", label: "Growth", blurb: "Up to 10 staff, WhatsApp/SMS, automations." },
  { code: "PRO", label: "Pro", blurb: "Multi-location, advanced analytics, white-label." },
] as const;

export const CreateBusinessSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name."),
  businessType: z.enum(BUSINESS_TYPES.map((t) => t.value) as [string, ...string[]]),
  country: z.string().trim().min(2).default("AE"),
  currency: z.string().trim().min(3).max(3).default("AED"),
  timezone: z.string().trim().min(1).default("Asia/Dubai"),
  locationName: z.string().trim().min(2, "Enter a name for your first location."),
  locationAddress: z.string().trim().optional(),
  locationPhone: z.string().trim().optional(),
  planCode: z.enum(PLAN_CHOICES.map((p) => p.code) as [string, ...string[]]).default("GROWTH"),
});
