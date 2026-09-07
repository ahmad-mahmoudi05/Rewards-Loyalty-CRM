import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  evaluateInactiveWinback,
  evaluateBirthdayReward,
  evaluateRewardReadyReminder,
  evaluateVipUpgrade,
} from "@/services/automations/evaluate";
import { getEntitlements, billingGateMessage } from "@/lib/entitlements";

const EVALUATORS = {
  INACTIVE_WINBACK: evaluateInactiveWinback,
  BIRTHDAY_REWARD: evaluateBirthdayReward,
  REWARD_READY_REMINDER: evaluateRewardReadyReminder,
  VIP_UPGRADE: evaluateVipUpgrade,
} as const;

/**
 * Time-based automation evaluation. A reasonable cadence for this MVP is
 * hourly (configure a platform cron against this route) — inactivity/
 * birthday/reward-reminder conditions don't need minute-level precision,
 * and this avoids scanning every customer row too aggressively. Event-driven
 * checks (VIP threshold crossing) additionally run right after a
 * transaction is recorded — see services/campaigns/... record_transaction
 * call sites — so VIP doesn't wait for the next scheduled tick.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceRoleClient();
  const { data: automations } = await supabase.from("automations").select("*, business:businesses(*)").eq("enabled", true);

  const summary: Record<string, unknown> = {};
  for (const automation of automations ?? []) {
    if (!automation.business) continue;
    const evaluator = EVALUATORS[automation.trigger_type as keyof typeof EVALUATORS];
    if (!evaluator) continue;

    // Re-checked on every run, not just at save time: a business that
    // downgrades or lets its trial lapse after enabling an automation must
    // stop triggering it, not just be blocked from enabling a new one.
    const entitlements = await getEntitlements(supabase, automation.business_id);
    if (!entitlements.automationEnabled || billingGateMessage(entitlements)) {
      summary[automation.id] = { type: automation.trigger_type, business: automation.business.name, skipped: "entitlement" };
      continue;
    }

    const result = await evaluator(supabase, automation.business, automation);
    summary[automation.id] = { type: automation.trigger_type, business: automation.business.name, ...result };
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), automations: summary });
}
