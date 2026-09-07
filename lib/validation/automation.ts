import { z } from "zod";

export const AUTOMATION_TYPES = [
  {
    key: "INACTIVE_WINBACK",
    name: "Inactive Customer Win-Back",
    description: "Bring inactive customers back automatically.",
  },
  {
    key: "BIRTHDAY_REWARD",
    name: "Birthday Reward",
    description: "Celebrate customers automatically.",
  },
  {
    key: "REWARD_READY_REMINDER",
    name: "Reward-Ready Reminder",
    description: "Remind customers they've already earned something.",
  },
  {
    key: "VIP_UPGRADE",
    name: "VIP Upgrade",
    description: "Automatically recognize your best customers.",
  },
  {
    key: "LOYALTY_EXPIRY_REMINDER",
    name: "Expiry Reminder",
    description: "Create urgency before loyalty value expires.",
  },
] as const;

export type AutomationType = (typeof AUTOMATION_TYPES)[number]["key"];

const BonusType = z.enum(["NONE", "BONUS_POINTS", "BONUS_STAMPS", "CUSTOM_REWARD"]);
const Channel = z.enum(["WHATSAPP", "SMS", "EMAIL"]);

export const InactiveWinbackConfigSchema = z.object({
  inactiveDays: z.coerce.number().int().min(1).max(365),
  cooldownDays: z.coerce.number().int().min(1).max(365).default(60),
  bonusType: BonusType.default("NONE"),
  bonusValue: z.coerce.number().nonnegative().optional(),
  message: z.string().trim().min(1),
});

export const BirthdayRewardConfigSchema = z.object({
  leadDays: z.coerce.number().int().min(0).max(7),
  rewardType: z.enum(["BONUS_POINTS", "BONUS_STAMPS", "CUSTOM_REWARD", "FREE_ITEM", "FIXED_DISCOUNT", "PERCENT_DISCOUNT"]),
  rewardValue: z.coerce.number().nonnegative().optional(),
  rewardDescription: z.string().trim().optional(),
  message: z.string().trim().min(1),
});

export const RewardReadyReminderConfigSchema = z.object({
  delayDays: z.coerce.number().int().min(0).max(30),
  followUp: z.boolean().default(false),
  message: z.string().trim().min(1),
});

export const VipUpgradeConfigSchema = z.object({
  criteria: z.enum(["TOTAL_SPEND", "TRANSACTION_COUNT"]),
  threshold: z.coerce.number().positive(),
  bonusType: BonusType.default("NONE"),
  bonusValue: z.coerce.number().nonnegative().optional(),
  message: z.string().trim().min(1),
});

export const LoyaltyExpiryReminderConfigSchema = z.object({
  reminderDays: z.coerce.number().int().min(1).max(90),
  message: z.string().trim().min(1),
});

export const AutomationConfigSchemas = {
  INACTIVE_WINBACK: InactiveWinbackConfigSchema,
  BIRTHDAY_REWARD: BirthdayRewardConfigSchema,
  REWARD_READY_REMINDER: RewardReadyReminderConfigSchema,
  VIP_UPGRADE: VipUpgradeConfigSchema,
  LOYALTY_EXPIRY_REMINDER: LoyaltyExpiryReminderConfigSchema,
} as const;

export const SaveAutomationSchema = z.object({
  enabled: z.boolean(),
  channel: Channel,
});
