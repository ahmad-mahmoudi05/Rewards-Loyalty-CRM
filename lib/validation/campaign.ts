import { z } from "zod";
import { SEGMENTS } from "@/services/campaigns/segment-definitions";

const segmentKeys = SEGMENTS.map((s) => s.key) as [string, ...string[]];

export const CreateCampaignSchema = z.object({
  name: z.string().trim().min(2, "Give this campaign a name."),
  channel: z.enum(["EMAIL", "WHATSAPP", "SMS"]),
  segment: z.enum(segmentKeys),
  spendThreshold: z.coerce.number().positive().optional(),
  visitThreshold: z.coerce.number().int().positive().optional(),
  subject: z.string().trim().optional(),
  message: z.string().trim().min(1, "Write a message."),
  scheduledAt: z.string().optional(),
});

export const TestSendSchema = z.object({
  campaignId: z.uuid(),
  destination: z.string().trim().min(3, "Enter a destination."),
});
