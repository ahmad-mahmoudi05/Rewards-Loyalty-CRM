"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { UpdateBrandingSchema } from "@/lib/validation/branding";

export type UpdateBrandingState = { error?: string; success?: boolean } | undefined;

export async function updateBranding(_state: UpdateBrandingState, formData: FormData): Promise<UpdateBrandingState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);

  const parsed = UpdateBrandingSchema.safeParse({
    logoUrl: formData.get("logoUrl") || "",
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor") || "",
    backgroundColor: formData.get("backgroundColor"),
    textColor: formData.get("textColor"),
    buttonStyle: formData.get("buttonStyle"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form for errors." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("business_branding")
    .update({
      logo_url: parsed.data.logoUrl || null,
      primary_color: parsed.data.primaryColor,
      secondary_color: parsed.data.secondaryColor || null,
      background_color: parsed.data.backgroundColor,
      text_color: parsed.data.textColor,
      button_style: parsed.data.buttonStyle,
    })
    .eq("business_id", membership.business_id);

  if (error) return { error: "Could not save branding. Please try again." };

  revalidatePath("/dashboard/branding");
  return { success: true };
}
