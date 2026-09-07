import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { AUTOMATION_TYPES } from "@/lib/validation/automation";

function summarizeConfig(type: string, config: Record<string, unknown> | null): string {
  if (!config) return "Not configured yet";
  switch (type) {
    case "INACTIVE_WINBACK":
      return `${config.inactiveDays} days inactive`;
    case "BIRTHDAY_REWARD":
      return config.leadDays === 0 ? "On birthday" : `${config.leadDays} day(s) before birthday`;
    case "REWARD_READY_REMINDER":
      return config.delayDays === 0 ? "Immediately when earned" : `${config.delayDays} day(s) after earned`;
    case "VIP_UPGRADE":
      return `${config.criteria === "TOTAL_SPEND" ? "Spend" : "Visits"} ≥ ${config.threshold}`;
    case "LOYALTY_EXPIRY_REMINDER":
      return `${config.reminderDays} day(s) before expiry`;
    default:
      return "";
  }
}

export default async function AutomationsPage() {
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const supabase = await createClient();

  const { data: automations } = await supabase
    .from("automations")
    .select("*")
    .eq("business_id", membership.business_id);

  const byType = new Map((automations ?? []).map((a) => [a.trigger_type, a]));

  const { data: runCounts } = await supabase
    .from("automation_runs")
    .select("automation_id, status")
    .eq("business_id", membership.business_id);

  const countsByAutomation = new Map<string, { sent: number; last: string | null }>();
  for (const run of runCounts ?? []) {
    const entry = countsByAutomation.get(run.automation_id) ?? { sent: 0, last: null };
    if (run.status === "SENT") entry.sent++;
    countsByAutomation.set(run.automation_id, entry);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Automations</h1>
        <p className="text-sm text-foreground/70">
          LoyalNest watches customer behavior and brings them back automatically — no manual work.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {AUTOMATION_TYPES.map((type) => {
          const automation = byType.get(type.key);
          const counts = automation ? countsByAutomation.get(automation.id) : undefined;
          return (
            <Link
              key={type.key}
              href={`/dashboard/automations/${type.key}`}
              className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-5 hover:bg-foreground/5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium">{type.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    automation?.enabled ? "bg-green-100 text-green-800" : "bg-foreground/10 text-foreground/50"
                  }`}
                >
                  {automation?.enabled ? "ON" : "OFF"}
                </span>
              </div>
              <p className="text-sm text-foreground/60">{type.description}</p>
              <p className="text-xs text-foreground/50">
                {summarizeConfig(type.key, automation?.configuration as Record<string, unknown> | null)}
                {automation && ` · ${automation.channel}`}
              </p>
              {counts && <p className="text-xs text-foreground/50">{counts.sent} customers triggered</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
