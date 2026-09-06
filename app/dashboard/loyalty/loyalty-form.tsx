"use client";

import { useActionState, useState } from "react";
import { REWARD_TYPES } from "@/lib/validation/loyalty";
import { saveLoyaltyProgram } from "./actions";
import type { Database } from "@/lib/supabase/database.types";

type LoyaltyProgram = Database["public"]["Tables"]["loyalty_programs"]["Row"];

const inputClass =
  "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";
const labelClass = "text-sm font-medium";

export function LoyaltyForm({ program }: { program: LoyaltyProgram | null }) {
  const [state, formAction, pending] = useActionState(saveLoyaltyProgram, undefined);
  const [type, setType] = useState<"STAMPS" | "POINTS">(program?.type === "POINTS" ? "POINTS" : "STAMPS");

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6">
      {program && <input type="hidden" name="programId" value={program.id} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClass}>
          Program name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={program?.name ?? ""}
          placeholder="Brew Rewards"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className={labelClass}>
          Description (optional)
        </label>
        <input id="description" name="description" defaultValue={program?.description ?? ""} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Program type</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="type"
              value="STAMPS"
              checked={type === "STAMPS"}
              onChange={() => setType("STAMPS")}
            />
            Stamps
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="type"
              value="POINTS"
              checked={type === "POINTS"}
              onChange={() => setType("POINTS")}
            />
            Points
          </label>
        </div>
      </div>

      {type === "STAMPS" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stampRequiredCount" className={labelClass}>
              Qualifying transactions required
            </label>
            <input
              id="stampRequiredCount"
              name="stampRequiredCount"
              type="number"
              min={1}
              required
              defaultValue={program?.stamp_required_count ?? 5}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stampMinTransactionValue" className={labelClass}>
              Minimum transaction value (optional)
            </label>
            <input
              id="stampMinTransactionValue"
              name="stampMinTransactionValue"
              type="number"
              min={0}
              step="0.01"
              defaultValue={program?.stamp_min_transaction_value ?? ""}
              className={inputClass}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pointsPerCurrencyUnit" className={labelClass}>
              Points earned per currency unit spent
            </label>
            <input
              id="pointsPerCurrencyUnit"
              name="pointsPerCurrencyUnit"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={program?.points_per_currency_unit ?? 1}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pointsMinTransactionValue" className={labelClass}>
              Minimum transaction value (optional)
            </label>
            <input
              id="pointsMinTransactionValue"
              name="pointsMinTransactionValue"
              type="number"
              min={0}
              step="0.01"
              defaultValue={program?.points_min_transaction_value ?? ""}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pointsRewardThreshold" className={labelClass}>
              Points needed for a reward
            </label>
            <input
              id="pointsRewardThreshold"
              name="pointsRewardThreshold"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={program?.points_reward_threshold ?? 500}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-foreground/10 pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Reward</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="rewardName" className={labelClass}>
            Reward name
          </label>
          <input
            id="rewardName"
            name="rewardName"
            required
            defaultValue={program?.reward_name ?? ""}
            placeholder="Free Regular Coffee"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="rewardDescription" className={labelClass}>
            Reward description (optional)
          </label>
          <input
            id="rewardDescription"
            name="rewardDescription"
            defaultValue={program?.reward_description ?? ""}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rewardType" className={labelClass}>
              Reward type
            </label>
            <select id="rewardType" name="rewardType" defaultValue={program?.reward_type ?? "FREE_ITEM"} className={inputClass}>
              {REWARD_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rewardValue" className={labelClass}>
              Reward value (optional)
            </label>
            <input
              id="rewardValue"
              name="rewardValue"
              type="number"
              min={0}
              step="0.01"
              defaultValue={program?.reward_value ?? ""}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rewardExpiryDays" className={labelClass}>
              Expires after (days, optional)
            </label>
            <input
              id="rewardExpiryDays"
              name="rewardExpiryDays"
              type="number"
              min={1}
              defaultValue={program?.reward_expiry_days ?? ""}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-foreground/10 pt-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="progressResetsOnRedeem"
            defaultChecked={program?.progress_resets_on_redeem ?? true}
            className="mt-0.5"
          />
          <span>
            Reset progress after a reward is earned
            <span className="block text-xs text-foreground/60">
              Any excess above the threshold carries into the next cycle instead of being lost.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="allowMultipleRewards"
            defaultChecked={program?.allow_multiple_rewards ?? true}
            className="mt-0.5"
          />
          <span>Allow a customer to hold more than one unredeemed reward at a time</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={program?.is_active ?? true} className="mt-0.5" />
          <span>Program is active</span>
        </label>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Saved.</p>}

      <button
        disabled={pending}
        type="submit"
        className="w-fit rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : program ? "Save changes" : "Create program"}
      </button>
    </form>
  );
}
