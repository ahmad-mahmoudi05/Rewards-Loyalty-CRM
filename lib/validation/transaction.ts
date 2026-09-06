import { z } from "zod";

export const RecordTransactionSchema = z.object({
  customerId: z.uuid(),
  loyaltyProgramId: z.uuid(),
  locationId: z.uuid().optional(),
  total: z.coerce.number().positive("Enter an amount greater than 0."),
});

export const RedeemRewardSchema = z.object({
  rewardId: z.uuid(),
  locationId: z.uuid().optional(),
});
