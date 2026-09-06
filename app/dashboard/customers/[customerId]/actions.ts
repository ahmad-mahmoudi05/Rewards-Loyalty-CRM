"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBusinessContext } from "@/lib/dal";
import { RecordTransactionSchema, RedeemRewardSchema } from "@/lib/validation/transaction";

export type RecordTransactionState = { error?: string; success?: boolean } | undefined;

export async function recordTransaction(
  _state: RecordTransactionState,
  formData: FormData
): Promise<RecordTransactionState> {
  const membership = await requireBusinessContext();

  const parsed = RecordTransactionSchema.safeParse({
    customerId: formData.get("customerId"),
    loyaltyProgramId: formData.get("loyaltyProgramId"),
    locationId: formData.get("locationId") || undefined,
    total: formData.get("total"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the transaction amount." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_transaction", {
    p_business_id: membership.business_id,
    p_customer_id: parsed.data.customerId,
    p_loyalty_program_id: parsed.data.loyaltyProgramId,
    p_total: parsed.data.total,
    p_location_id: parsed.data.locationId,
  });

  if (error) {
    return { error: error.message || "This transaction could not be recorded." };
  }

  revalidatePath(`/dashboard/customers/${parsed.data.customerId}`);
  revalidatePath("/dashboard/customers");
  return { success: true };
}

export type RedeemRewardState = { error?: string; success?: boolean } | undefined;

export async function redeemReward(
  customerId: string,
  _state: RedeemRewardState,
  formData: FormData
): Promise<RedeemRewardState> {
  const membership = await requireBusinessContext();

  const parsed = RedeemRewardSchema.safeParse({
    rewardId: formData.get("rewardId"),
    locationId: formData.get("locationId") || undefined,
  });

  if (!parsed.success) {
    return { error: "Invalid reward." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_reward", {
    p_business_id: membership.business_id,
    p_reward_id: parsed.data.rewardId,
    p_location_id: parsed.data.locationId,
  });

  if (error) {
    return { error: error.message || "This reward has already been redeemed." };
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/customers");
  return { success: true };
}
