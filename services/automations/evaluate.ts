import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  InactiveWinbackConfigSchema,
  BirthdayRewardConfigSchema,
  RewardReadyReminderConfigSchema,
  VipUpgradeConfigSchema,
} from "@/lib/validation/automation";
import { claimAutomationRun, sendAutomationMessage, addSystemTag, removeSystemTag } from "./shared";

type Automation = Database["public"]["Tables"]["automations"]["Row"];
type Business = Database["public"]["Tables"]["businesses"]["Row"];

export type EvaluationResult = { evaluated: number; sent: number; skipped: number; failed: number };

const EMPTY: EvaluationResult = { evaluated: 0, sent: 0, skipped: 0, failed: 0 };

function isoDate(value: string) {
  return value.slice(0, 10);
}

/**
 * Month/day/year as seen in a specific IANA timezone, not server-UTC — used
 * for birthday matching so a business several hours off UTC doesn't fire on
 * the wrong local calendar day. Falls back to UTC if the stored timezone
 * string is somehow invalid (Intl throws on construction, not on format).
 */
function partsInTimezone(date: Date, timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return { year: get("year"), month: get("month") - 1, day: get("day") };
  } catch {
    return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
  }
}

async function getActiveProgramId(supabase: SupabaseClient<Database>, businessId: string) {
  const { data } = await supabase
    .from("loyalty_programs")
    .select("id")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function applyBonus(
  supabase: SupabaseClient<Database>,
  businessId: string,
  customerId: string,
  bonusType: string,
  bonusValue: number | undefined,
  description: string
) {
  if (bonusType === "NONE") return;
  const programId = await getActiveProgramId(supabase, businessId);
  if (!programId) return;
  if (bonusType === "BONUS_POINTS") {
    await supabase.rpc("grant_automation_bonus", {
      p_business_id: businessId,
      p_customer_id: customerId,
      p_loyalty_program_id: programId,
      p_points_delta: bonusValue ?? 0,
      p_stamps_delta: 0,
      p_description: description,
    });
  } else if (bonusType === "BONUS_STAMPS") {
    await supabase.rpc("grant_automation_bonus", {
      p_business_id: businessId,
      p_customer_id: customerId,
      p_loyalty_program_id: programId,
      p_points_delta: 0,
      p_stamps_delta: Math.round(bonusValue ?? 1),
      p_description: description,
    });
  }
  // CUSTOM_REWARD: no structured ledger effect for v1 — the message itself
  // communicates it; a manual reward can be added by staff if needed.
}

export async function evaluateInactiveWinback(
  supabase: SupabaseClient<Database>,
  business: Business,
  automation: Automation
): Promise<EvaluationResult> {
  const config = InactiveWinbackConfigSchema.safeParse(automation.configuration);
  if (!config.success) return EMPTY;
  const cfg = config.data;

  const cutoff = new Date(Date.now() - cfg.inactiveDays * 86400000).toISOString();
  const { data: customers } = await supabase
    .from("customer_summary")
    .select("*")
    .eq("business_id", business.id)
    .or(`last_transaction_at.lt.${cutoff},and(last_transaction_at.is.null,created_at.lt.${cutoff})`);

  // cooldownDays: the dedupe key alone (below) changes the moment a
  // customer returns and goes inactive again, which would let them be
  // re-triggered with no minimum spacing — the UI promises a cooldown
  // (automation-form.tsx), so enforce it here as a second, independent
  // gate: has this automation already fired for this customer more
  // recently than cooldownDays, regardless of dedupe key?
  const cooldownCutoff = new Date(Date.now() - cfg.cooldownDays * 86400000).toISOString();
  const { data: recentRuns } = await supabase
    .from("automation_runs")
    .select("customer_id")
    .eq("automation_id", automation.id)
    .gte("created_at", cooldownCutoff);
  const cooledDownCustomerIds = new Set((recentRuns ?? []).map((r) => r.customer_id));

  const result = { ...EMPTY };
  for (const customer of customers ?? []) {
    if (cooledDownCustomerIds.has(customer.id!)) continue;
    result.evaluated++;
    // One customer's failure (a thrown error from claimAutomationRun on a
    // non-duplicate DB error, or from applyBonus/sendAutomationMessage)
    // must not abort evaluation for the rest of this business's customers,
    // or every other business/automation still queued in this cron tick —
    // matches the campaign engine's existing per-recipient isolation.
    try {
      const baselineDate = customer.last_transaction_at ?? customer.created_at;
      const dedupeKey = `INACTIVE_${isoDate(baselineDate!)}`;

      const runId = await claimAutomationRun(supabase, {
        automationId: automation.id,
        businessId: business.id,
        customerId: customer.id!,
        dedupeKey,
      });
      if (!runId) continue; // already handled this cycle

      await addSystemTag(supabase, business.id, customer.id!, "AT_RISK");
      if (cfg.bonusType !== "NONE") {
        await applyBonus(supabase, business.id, customer.id!, cfg.bonusType, cfg.bonusValue, "Inactive customer win-back bonus");
      }

      const { sent, reason } = await sendAutomationMessage(supabase, {
        runId,
        business,
        customer,
        channel: automation.channel as "EMAIL" | "WHATSAPP" | "SMS",
        message: cfg.message,
        context: {
          first_name: customer.first_name ?? "there",
          business_name: business.name,
          offer: cfg.bonusType === "BONUS_POINTS" ? `${cfg.bonusValue} bonus points` : cfg.bonusType === "BONUS_STAMPS" ? "a bonus stamp" : undefined,
        },
      });
      if (sent) result.sent++;
      else if (reason === "no_consent") result.skipped++;
      else result.failed++;
    } catch (err) {
      console.error("[automations] INACTIVE_WINBACK failed for customer", customer.id, err);
      result.failed++;
    }
  }

  // Clear AT_RISK from anyone who has since returned.
  const { data: recovered } = await supabase
    .from("customer_summary")
    .select("id")
    .eq("business_id", business.id)
    .gte("last_transaction_at", cutoff);
  for (const c of recovered ?? []) {
    await removeSystemTag(supabase, business.id, c.id!, "AT_RISK");
  }

  return result;
}

export async function evaluateBirthdayReward(
  supabase: SupabaseClient<Database>,
  business: Business,
  automation: Automation
): Promise<EvaluationResult> {
  const config = BirthdayRewardConfigSchema.safeParse(automation.configuration);
  if (!config.success) return EMPTY;
  const cfg = config.data;

  const target = new Date(Date.now() + cfg.leadDays * 86400000);
  const { month: targetMonth, day: targetDay } = partsInTimezone(target, business.timezone);
  const { year } = partsInTimezone(new Date(), business.timezone);

  const { data: customers } = await supabase
    .from("customer_summary")
    .select("*")
    .eq("business_id", business.id)
    .not("birthday", "is", null);

  const result = { ...EMPTY };
  for (const customer of customers ?? []) {
    const bday = new Date(customer.birthday! + "T00:00:00Z");
    if (bday.getUTCMonth() !== targetMonth || bday.getUTCDate() !== targetDay) continue;
    result.evaluated++;

    try {
    const runId = await claimAutomationRun(supabase, {
      automationId: automation.id,
      businessId: business.id,
      customerId: customer.id!,
      dedupeKey: `BIRTHDAY_${year}`,
    });
    if (!runId) continue;

    if (cfg.rewardType === "BONUS_POINTS" || cfg.rewardType === "BONUS_STAMPS") {
      await applyBonus(supabase, business.id, customer.id!, cfg.rewardType, cfg.rewardValue, "Birthday reward");
    } else {
      await supabase.from("customer_offers").insert({
        business_id: business.id,
        customer_id: customer.id!,
        offer_type: cfg.rewardType,
        value: cfg.rewardValue ?? null,
        status: "ACTIVE",
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      });
    }

    const { sent, reason } = await sendAutomationMessage(supabase, {
      runId,
      business,
      customer,
      channel: automation.channel as "EMAIL" | "WHATSAPP" | "SMS",
      message: cfg.message,
      context: {
        first_name: customer.first_name ?? "there",
        business_name: business.name,
        reward_name: cfg.rewardDescription,
      },
    });
    if (sent) result.sent++;
    else if (reason === "no_consent") result.skipped++;
    else result.failed++;
    } catch (err) {
      console.error("[automations] BIRTHDAY_REWARD failed for customer", customer.id, err);
      result.failed++;
    }
  }

  return result;
}

export async function evaluateRewardReadyReminder(
  supabase: SupabaseClient<Database>,
  business: Business,
  automation: Automation
): Promise<EvaluationResult> {
  const config = RewardReadyReminderConfigSchema.safeParse(automation.configuration);
  if (!config.success) return EMPTY;
  const cfg = config.data;

  const cutoff = new Date(Date.now() - cfg.delayDays * 86400000).toISOString();
  const { data: rewards } = await supabase
    .from("rewards")
    .select("*")
    .eq("business_id", business.id)
    .eq("status", "AVAILABLE")
    .lte("generated_at", cutoff);

  const result = { ...EMPTY };
  for (const reward of rewards ?? []) {
    result.evaluated++;

    try {
    const runId = await claimAutomationRun(supabase, {
      automationId: automation.id,
      businessId: business.id,
      customerId: reward.customer_id,
      dedupeKey: `REWARD_REMINDER_${reward.id}_initial`,
      triggerEntityId: reward.id,
    });
    if (runId) {
      // Re-check eligibility right before send (Part: "eligibility must be re-checked").
      const { data: fresh } = await supabase.from("rewards").select("status").eq("id", reward.id).single();
      if (fresh?.status !== "AVAILABLE") {
        await supabase.from("automation_runs").update({ status: "SKIPPED", action_result: { reason: "already_redeemed" } }).eq("id", runId);
        result.skipped++;
      } else {
        const { data: customer } = await supabase.from("customer_summary").select("*").eq("id", reward.customer_id).single();
        if (customer) {
          const { sent, reason } = await sendAutomationMessage(supabase, {
            runId,
            business,
            customer,
            channel: automation.channel as "EMAIL" | "WHATSAPP" | "SMS",
            message: cfg.message,
            context: { first_name: customer.first_name ?? "there", business_name: business.name, reward_name: reward.name },
          });
          if (sent) result.sent++;
          else if (reason === "no_consent") result.skipped++;
          else result.failed++;
        }
      }
    }

    if (cfg.followUp && reward.expires_at) {
      const daysToExpiry = (new Date(reward.expires_at).getTime() - Date.now()) / 86400000;
      if (daysToExpiry <= 3 && daysToExpiry > 0) {
        const followRunId = await claimAutomationRun(supabase, {
          automationId: automation.id,
          businessId: business.id,
          customerId: reward.customer_id,
          dedupeKey: `REWARD_REMINDER_${reward.id}_followup`,
          triggerEntityId: reward.id,
        });
        if (followRunId) {
          const { data: fresh } = await supabase.from("rewards").select("status").eq("id", reward.id).single();
          if (fresh?.status === "AVAILABLE") {
            const { data: customer } = await supabase.from("customer_summary").select("*").eq("id", reward.customer_id).single();
            if (customer) {
              await sendAutomationMessage(supabase, {
                runId: followRunId,
                business,
                customer,
                channel: automation.channel as "EMAIL" | "WHATSAPP" | "SMS",
                message: cfg.message,
                context: { first_name: customer.first_name ?? "there", business_name: business.name, reward_name: reward.name },
              });
            }
          } else {
            await supabase.from("automation_runs").update({ status: "SKIPPED", action_result: { reason: "already_redeemed" } }).eq("id", followRunId);
          }
        }
      }
    }
    } catch (err) {
      console.error("[automations] REWARD_READY_REMINDER failed for reward", reward.id, err);
      result.failed++;
    }
  }

  return result;
}

export async function evaluateVipUpgrade(
  supabase: SupabaseClient<Database>,
  business: Business,
  automation: Automation
): Promise<EvaluationResult> {
  const config = VipUpgradeConfigSchema.safeParse(automation.configuration);
  if (!config.success) return EMPTY;
  const cfg = config.data;

  let query = supabase.from("customer_summary").select("*").eq("business_id", business.id);
  query = cfg.criteria === "TOTAL_SPEND" ? query.gte("total_spend", cfg.threshold) : query.gte("transaction_count", cfg.threshold);
  const { data: customers } = await query;

  const result = { ...EMPTY };
  for (const customer of customers ?? []) {
    result.evaluated++;
    try {
      const runId = await claimAutomationRun(supabase, {
        automationId: automation.id,
        businessId: business.id,
        customerId: customer.id!,
        dedupeKey: "VIP",
      });
      if (!runId) continue;

      await addSystemTag(supabase, business.id, customer.id!, "VIP");
      if (cfg.bonusType !== "NONE") {
        await applyBonus(supabase, business.id, customer.id!, cfg.bonusType, cfg.bonusValue, "VIP upgrade bonus");
      }

      const { sent, reason } = await sendAutomationMessage(supabase, {
        runId,
        business,
        customer,
        channel: automation.channel as "EMAIL" | "WHATSAPP" | "SMS",
        message: cfg.message,
        context: { first_name: customer.first_name ?? "there", business_name: business.name },
      });
      if (sent) result.sent++;
      else if (reason === "no_consent") result.skipped++;
      else result.failed++;
    } catch (err) {
      console.error("[automations] VIP_UPGRADE failed for customer", customer.id, err);
      result.failed++;
    }
  }

  return result;
}
