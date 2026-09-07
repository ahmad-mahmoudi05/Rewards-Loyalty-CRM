"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { CreateLocationSchema } from "@/lib/validation/location";
import { getEntitlements, usageLimitMessage } from "@/lib/entitlements";

export type CreateLocationState = { error?: string; success?: boolean } | undefined;

/**
 * Day 5: previously there was no way to add a second location at all —
 * without this, the Pro plan's headline "multi-location" entitlement had
 * nothing to actually gate. `max_locations` is enforced here, server-side.
 */
export async function createLocation(_state: CreateLocationState, formData: FormData): Promise<CreateLocationState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);

  const parsed = CreateLocationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form for errors." };
  }

  const supabase = await createClient();
  const [entitlements, { count: currentLocations }] = await Promise.all([
    getEntitlements(supabase, membership.business_id),
    supabase.from("locations").select("id", { count: "exact", head: true }).eq("business_id", membership.business_id),
  ]);

  const limitMessage = usageLimitMessage({
    current: currentLocations ?? 0,
    limit: entitlements.maxLocations,
    resource: "locations",
    planName: entitlements.planName,
  });
  if (limitMessage) return { error: limitMessage };

  const { error } = await supabase.from("locations").insert({
    business_id: membership.business_id,
    name: parsed.data.name,
    address: parsed.data.address,
    phone: parsed.data.phone,
    timezone: membership.business.timezone,
    is_primary: (currentLocations ?? 0) === 0,
  });

  if (error) return { error: "Could not create this location." };

  revalidatePath("/dashboard/locations");
  return { success: true };
}
