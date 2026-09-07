"use client";

import { useActionState, useState } from "react";
import { saveAutomation } from "../actions";
import type { AutomationType } from "@/lib/validation/automation";

type Config = Record<string, unknown>;

const inputClass =
  "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";
const labelClass = "text-sm font-medium";

export function AutomationForm({ type, automation }: { type: AutomationType; automation: { enabled: boolean; channel: string; configuration: Config } | null }) {
  const boundAction = saveAutomation.bind(null, type);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const cfg = automation?.configuration ?? {};
  const [message, setMessage] = useState((cfg.message as string) ?? defaultMessage(type));

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="enabled" defaultChecked={automation?.enabled ?? false} />
        Enable automation
      </label>

      {type === "INACTIVE_WINBACK" && (
        <>
          <Field label="Trigger after (days without a visit)">
            <input name="inactiveDays" type="number" min={1} defaultValue={(cfg.inactiveDays as number) ?? 30} className={inputClass} />
          </Field>
          <Field label="Cooldown (days) before this customer could be considered for this automation again">
            <input name="cooldownDays" type="number" min={1} defaultValue={(cfg.cooldownDays as number) ?? 60} className={inputClass} />
          </Field>
          <BonusFields cfg={cfg} />
        </>
      )}

      {type === "BIRTHDAY_REWARD" && (
        <>
          <Field label="Send">
            <select name="leadDays" defaultValue={(cfg.leadDays as number) ?? 1} className={inputClass}>
              <option value={0}>On birthday</option>
              <option value={1}>1 day before</option>
              <option value={3}>3 days before</option>
              <option value={7}>7 days before</option>
            </select>
          </Field>
          <Field label="Reward type">
            <select name="rewardType" defaultValue={(cfg.rewardType as string) ?? "BONUS_POINTS"} className={inputClass}>
              <option value="BONUS_POINTS">Bonus points</option>
              <option value="BONUS_STAMPS">Bonus stamps</option>
              <option value="FREE_ITEM">Free item</option>
              <option value="FIXED_DISCOUNT">Fixed discount</option>
              <option value="PERCENT_DISCOUNT">Percent discount</option>
              <option value="CUSTOM_REWARD">Custom reward</option>
            </select>
          </Field>
          <Field label="Reward value">
            <input name="rewardValue" type="number" min={0} defaultValue={(cfg.rewardValue as number) ?? 0} className={inputClass} />
          </Field>
          <Field label="Reward description (used in the {{reward_name}} variable)">
            <input name="rewardDescription" defaultValue={(cfg.rewardDescription as string) ?? ""} className={inputClass} />
          </Field>
        </>
      )}

      {type === "REWARD_READY_REMINDER" && (
        <>
          <Field label="Initial reminder delay">
            <select name="delayDays" defaultValue={(cfg.delayDays as number) ?? 1} className={inputClass}>
              <option value={0}>Immediately</option>
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="followUp" defaultChecked={Boolean(cfg.followUp)} />
            Send one follow-up reminder before the reward expires
          </label>
        </>
      )}

      {type === "VIP_UPGRADE" && (
        <>
          <Field label="Qualifying criteria">
            <select name="criteria" defaultValue={(cfg.criteria as string) ?? "TOTAL_SPEND"} className={inputClass}>
              <option value="TOTAL_SPEND">Total spend</option>
              <option value="TRANSACTION_COUNT">Total visits</option>
            </select>
          </Field>
          <Field label="Threshold">
            <input name="threshold" type="number" min={1} defaultValue={(cfg.threshold as number) ?? 2000} className={inputClass} />
          </Field>
          <BonusFields cfg={cfg} />
        </>
      )}

      {type === "LOYALTY_EXPIRY_REMINDER" && (
        <>
          <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
            The loyalty engine doesn&apos;t support points/stamps expiration yet, so this
            automation can be configured but will never actually trigger. See
            docs/integrations.md.
          </p>
          <Field label="Remind before expiry">
            <select name="reminderDays" defaultValue={(cfg.reminderDays as number) ?? 7} className={inputClass}>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </Field>
        </>
      )}

      <Field label="Channel">
        <select name="channel" defaultValue={automation?.channel ?? "EMAIL"} className={inputClass}>
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="SMS">SMS</option>
        </select>
      </Field>

      <Field label="Message">
        <textarea
          name="message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="rounded-lg bg-foreground/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Preview</p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{renderPreview(message)}</p>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Saved.</p>}

      <button
        disabled={pending}
        type="submit"
        className="w-fit rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save automation"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function BonusFields({ cfg }: { cfg: Config }) {
  return (
    <>
      <Field label="Bonus">
        <select name="bonusType" defaultValue={(cfg.bonusType as string) ?? "NONE"} className={inputClass}>
          <option value="NONE">No bonus, message only</option>
          <option value="BONUS_POINTS">Bonus points</option>
          <option value="BONUS_STAMPS">Bonus stamps</option>
          <option value="CUSTOM_REWARD">Custom reward</option>
        </select>
      </Field>
      <Field label="Bonus value">
        <input name="bonusValue" type="number" min={0} defaultValue={(cfg.bonusValue as number) ?? 0} className={inputClass} />
      </Field>
    </>
  );
}

function defaultMessage(type: AutomationType) {
  switch (type) {
    case "INACTIVE_WINBACK":
      return "Hi {{first_name}} 👋\nWe haven't seen you recently. Come back to {{business_name}} and enjoy {{offer}}.";
    case "BIRTHDAY_REWARD":
      return "Happy Birthday {{first_name}} 🎉\nWe've got something special waiting for you at {{business_name}}.";
    case "REWARD_READY_REMINDER":
      return "{{first_name}}, your {{reward_name}} is ready ☕ Come claim it at {{business_name}}.";
    case "VIP_UPGRADE":
      return "You're officially a {{business_name}} VIP 🎉 Thanks for being one of our best customers.";
    case "LOYALTY_EXPIRY_REMINDER":
      return "{{first_name}}, your points expire soon. Visit {{business_name}} and use them before they're gone.";
  }
}

function renderPreview(message: string) {
  return message
    .replaceAll("{{first_name}}", "Ahmad")
    .replaceAll("{{business_name}}", "Brew Café")
    .replaceAll("{{offer}}", "50 bonus points")
    .replaceAll("{{reward_name}}", "Free Regular Coffee")
    .replaceAll("{{points}}", "320")
    .replaceAll("{{stamps}}", "4")
    .replaceAll("{{remaining}}", "1")
    .replaceAll("{{expiry}}", "September 14");
}
