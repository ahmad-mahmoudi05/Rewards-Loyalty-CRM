"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBusinessContext } from "@/lib/dal";
import { LoyaltyProgramSchema } from "@/lib/validation/loyalty";
import type { Database } from "@/lib/supabase/database.types";

type LoyaltyProgramInsert = Database["public"]["Tables"]["loyalty_programs"]["Insert"];

export type SaveLoyaltyProgramState = { error?: string; success?: boolean } | undefined;

function readBool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function saveLoyaltyProgram(
  _state: SaveLoyaltyProgramState,
  formData: FormData
): Promise<SaveLoyaltyProgramState> {
  const membership = await requireBusinessContext();

  if (membership.role !== "OWNER" && membership.role !== "MANAGER") {
    return { error: "Only an owner or manager can configure the loyalty program." };
  }

  const type = formData.get("type");
  const shared = {
    type,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    rewardName: formData.get("rewardName"),
    rewardDescription: formData.get("rewardDescription") || undefined,
    rewardType: formData.get("rewardType"),
    rewardValue: formData.get("rewardValue") || undefined,
    rewardExpiryDays: formData.get("rewardExpiryDays") || undefined,
    progressResetsOnRedeem: readBool(formData, "progressResetsOnRedeem"),
    allowMultipleRewards: readBool(formData, "allowMultipleRewards"),
    isActive: readBool(formData, "isActive"),
  };

  const raw =
    type === "STAMPS"
      ? {
          ...shared,
          stampRequiredCount: formData.get("stampRequiredCount"),
          stampMinTransactionValue: formData.get("stampMinTransactionValue") || undefined,
        }
      : {
          ...shared,
          pointsPerCurrencyUnit: formData.get("pointsPerCurrencyUnit"),
          pointsMinTransactionValue: formData.get("pointsMinTransactionValue") || undefined,
          pointsRewardThreshold: formData.get("pointsRewardThreshold"),
        };

  const parsed = LoyaltyProgramSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form for errors." };
  }

  const data = parsed.data;
  const record: LoyaltyProgramInsert = {
    business_id: membership.business_id,
    name: data.name,
    description: data.description ?? null,
    type: data.type,
    is_active: data.isActive,
    reward_name: data.rewardName,
    reward_description: data.rewardDescription ?? null,
    reward_type: data.rewardType,
    reward_value: data.rewardValue ?? null,
    reward_expiry_days: data.rewardExpiryDays ?? null,
    progress_resets_on_redeem: data.progressResetsOnRedeem,
    allow_multiple_rewards: data.allowMultipleRewards,
    stamp_required_count: data.type === "STAMPS" ? data.stampRequiredCount : null,
    stamp_min_transaction_value: data.type === "STAMPS" ? (data.stampMinTransactionValue ?? null) : null,
    points_per_currency_unit: data.type === "POINTS" ? data.pointsPerCurrencyUnit : null,
    points_min_transaction_value: data.type === "POINTS" ? (data.pointsMinTransactionValue ?? null) : null,
    points_reward_threshold: data.type === "POINTS" ? data.pointsRewardThreshold : null,
  };

  const supabase = await createClient();
  const programId = formData.get("programId");

  const { error } =
    typeof programId === "string" && programId.length > 0
      ? // .eq("business_id", ...) alongside .eq("id", ...) is defense in
        // depth, not the primary guard (RLS's USING clause on this table
        // already blocks a cross-tenant id) — but every other action in
        // this codebase pairs an app-layer business_id filter with RLS, so
        // this update matches that pattern instead of relying on RLS alone.
        await supabase.from("loyalty_programs").update(record).eq("id", programId).eq("business_id", membership.business_id)
      : await supabase.from("loyalty_programs").insert(record);

  if (error) {
    return { error: "Could not save the loyalty program. Check your inputs and try again." };
  }

  revalidatePath("/dashboard/loyalty");
  revalidatePath("/dashboard");
  return { success: true };
}
