"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { UpdateBusinessSettingsSchema } from "@/lib/validation/settings";

export type UpdateBusinessSettingsState = { error?: string; success?: boolean } | undefined;

// businesses_update_owner (migration 0008) is OWNER-only, unlike most other
// write policies in this schema — a business's legal name/type/currency is
// treated as a more sensitive setting than day-to-day branding, which
// MANAGER can also edit (see app/dashboard/branding/actions.ts).
export async function updateBusinessSettings(
  _state: UpdateBusinessSettingsState,
  formData: FormData
): Promise<UpdateBusinessSettingsState> {
  const membership = await requireRole(["OWNER"]);

  const parsed = UpdateBusinessSettingsSchema.safeParse({
    businessName: formData.get("businessName"),
    businessType: formData.get("businessType"),
    country: formData.get("country"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form for errors." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      name: parsed.data.businessName,
      business_type: parsed.data.businessType,
      country: parsed.data.country.toUpperCase(),
      currency: parsed.data.currency.toUpperCase(),
      timezone: parsed.data.timezone,
    })
    .eq("id", membership.business_id);

  if (error) return { error: "Could not save your business profile. Please try again." };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { success: true };
}
