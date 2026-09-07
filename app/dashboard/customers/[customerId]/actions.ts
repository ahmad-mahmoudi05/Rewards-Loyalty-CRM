"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBusinessContext } from "@/lib/dal";
import { RecordTransactionSchema, RedeemRewardSchema } from "@/lib/validation/transaction";
import { getEntitlements, billingGateMessage } from "@/lib/entitlements";

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

  const entitlements = await getEntitlements(supabase, membership.business_id);
  const gateMessage = billingGateMessage(entitlements);
  if (gateMessage) return { error: gateMessage };

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

export type RedeemOfferState = { error?: string; success?: boolean } | undefined;

export async function redeemOffer(customerId: string, _state: RedeemOfferState, formData: FormData): Promise<RedeemOfferState> {
  const membership = await requireBusinessContext();

  const offerId = formData.get("offerId");
  const locationId = formData.get("locationId");
  if (typeof offerId !== "string") {
    return { error: "Invalid offer." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_customer_offer", {
    p_business_id: membership.business_id,
    p_offer_id: offerId,
    p_location_id: typeof locationId === "string" && locationId ? locationId : undefined,
  });

  if (error) {
    return { error: error.message || "This offer has already been redeemed." };
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { success: true };
}

export type ReverseTransactionState = { error?: string; success?: boolean } | undefined;

export async function reverseTransactionAction(
  customerId: string,
  _state: ReverseTransactionState,
  formData: FormData
): Promise<ReverseTransactionState> {
  const membership = await requireBusinessContext();

  const transactionId = formData.get("transactionId");
  const reason = formData.get("reason");
  if (typeof transactionId !== "string" || typeof reason !== "string" || reason.trim().length < 3) {
    return { error: "Enter a reason for the reversal (at least 3 characters)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_transaction", {
    p_business_id: membership.business_id,
    p_transaction_id: transactionId,
    p_reason: reason.trim(),
  });

  if (error) {
    return { error: error.message || "This transaction could not be reversed." };
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { success: true };
}

export type RotateTokenState = { error?: string; success?: boolean } | undefined;

export async function rotateWalletTokenAction(
  customerId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, formData) call signature after .bind(null, customerId)
  _state: RotateTokenState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<RotateTokenState> {
  const membership = await requireBusinessContext();

  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_customer_wallet_token", {
    p_business_id: membership.business_id,
    p_customer_id: customerId,
  });

  if (error) {
    return { error: "Could not reset this customer's loyalty card." };
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { success: true };
}
