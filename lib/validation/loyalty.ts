import { z } from "zod";

export const REWARD_TYPES = [
  { value: "FREE_ITEM", label: "Free item" },
  { value: "DISCOUNT_PERCENT", label: "Percentage discount" },
  { value: "DISCOUNT_AMOUNT", label: "Amount discount" },
  { value: "CREDIT", label: "Account credit" },
] as const;

const RewardFieldsSchema = z.object({
  name: z.string().trim().min(2, "Give your program a name."),
  description: z.string().trim().optional(),
  rewardName: z.string().trim().min(2, "Give the reward a name."),
  rewardDescription: z.string().trim().optional(),
  rewardType: z.enum(REWARD_TYPES.map((r) => r.value) as [string, ...string[]]),
  rewardValue: z.coerce.number().nonnegative().optional(),
  rewardExpiryDays: z.coerce.number().int().positive().optional(),
  progressResetsOnRedeem: z.boolean().default(true),
  allowMultipleRewards: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const StampsProgramSchema = RewardFieldsSchema.extend({
  type: z.literal("STAMPS"),
  stampRequiredCount: z.coerce.number().int().min(1, "Must be at least 1 qualifying transaction."),
  stampMinTransactionValue: z.coerce.number().nonnegative().optional(),
});

export const PointsProgramSchema = RewardFieldsSchema.extend({
  type: z.literal("POINTS"),
  pointsPerCurrencyUnit: z.coerce.number().positive("Must be greater than 0."),
  pointsMinTransactionValue: z.coerce.number().nonnegative().optional(),
  pointsRewardThreshold: z.coerce.number().positive("Must be greater than 0."),
});

export const LoyaltyProgramSchema = z.discriminatedUnion("type", [
  StampsProgramSchema,
  PointsProgramSchema,
]);

export type LoyaltyProgramValues = z.infer<typeof LoyaltyProgramSchema>;
