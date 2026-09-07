import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { AUTOMATION_TYPES, type AutomationType } from "@/lib/validation/automation";
import { AutomationForm } from "./automation-form";

export default async function AutomationConfigPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const typeDef = AUTOMATION_TYPES.find((t) => t.key === type);
  if (!typeDef) notFound();

  const membership = await requireRole(["OWNER", "MANAGER"]);
  const supabase = await createClient();

  const { data: automation } = await supabase
    .from("automations")
    .select("enabled, channel, configuration")
    .eq("business_id", membership.business_id)
    .eq("trigger_type", type)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{typeDef.name}</h1>
        <p className="text-sm text-foreground/70">{typeDef.description}</p>
      </div>
      <AutomationForm
        type={type as AutomationType}
        automation={
          automation
            ? { enabled: automation.enabled, channel: automation.channel, configuration: (automation.configuration as Record<string, unknown>) ?? {} }
            : null
        }
      />
    </div>
  );
}
