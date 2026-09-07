"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  AUTOMATION_TYPES,
  AutomationConfigSchemas,
  type AutomationType,
} from "@/lib/validation/automation";
import { getEntitlements } from "@/lib/entitlements";

export type SaveAutomationState = { error?: string; success?: boolean } | undefined;

export async function saveAutomation(type: AutomationType, _state: SaveAutomationState, formData: FormData): Promise<SaveAutomationState> {
  const membership = await requireRole(["OWNER", "MANAGER"]);

  const schema = AutomationConfigSchemas[type];
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "enabled" || key === "channel") continue;
    raw[key] = value;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the configuration." };
  }

  const enabled = formData.get("enabled") === "on";
  const channel = formData.get("channel");
  if (channel !== "EMAIL" && channel !== "WHATSAPP" && channel !== "SMS") {
    return { error: "Choose a channel." };
  }

  const supabase = await createClient();

  if (enabled) {
    const entitlements = await getEntitlements(supabase, membership.business_id);
    if (!entitlements.automationEnabled) {
      return { error: `Automations aren't included in your ${entitlements.planName} plan. Upgrade in Billing to enable them.` };
    }
  }

  const name = AUTOMATION_TYPES.find((t) => t.key === type)?.name ?? type;

  const { data: existing } = await supabase
    .from("automations")
    .select("id")
    .eq("business_id", membership.business_id)
    .eq("trigger_type", type)
    .maybeSingle();

  const record = {
    business_id: membership.business_id,
    name,
    trigger_type: type,
    channel,
    configuration: parsed.data,
    enabled,
  };

  const { error } = existing
    ? await supabase.from("automations").update(record).eq("id", existing.id)
    : await supabase.from("automations").insert(record);

  if (error) {
    return { error: "Could not save this automation." };
  }

  revalidatePath("/dashboard/automations");
  revalidatePath(`/dashboard/automations/${type}`);
  return { success: true };
}
