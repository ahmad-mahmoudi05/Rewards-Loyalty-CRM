"use client";

import { useActionState, useState } from "react";
import { createCampaign } from "../actions";
import { SEGMENTS } from "@/services/campaigns/segment-definitions";

const inputClass =
  "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";
const labelClass = "text-sm font-medium";

export function CampaignForm() {
  const [state, formAction, pending] = useActionState(createCampaign, undefined);
  const [segment, setSegment] = useState<string>("ALL");
  const segmentDef = SEGMENTS.find((s) => s.key === segment);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClass}>
          Campaign name
        </label>
        <input id="name" name="name" required placeholder="Come back this week" className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="segment" className={labelClass}>
          Audience
        </label>
        <select id="segment" name="segment" value={segment} onChange={(e) => setSegment(e.target.value)} className={inputClass}>
          {SEGMENTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {segmentDef && "configurable" in segmentDef && segmentDef.configurable && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={segmentDef.configurable.field} className={labelClass}>
            {segmentDef.configurable.label}
          </label>
          <input
            id={segmentDef.configurable.field}
            name={segmentDef.configurable.field}
            type="number"
            defaultValue={segmentDef.configurable.default}
            className={inputClass}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="channel" className={labelClass}>
          Channel
        </label>
        <select id="channel" name="channel" defaultValue="EMAIL" className={inputClass}>
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="SMS">SMS</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className={labelClass}>
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder={"Hi {{first_name}} 👋\nWe haven't seen you recently. Come back to {{business_name}} this week."}
          className={inputClass}
        />
        <p className="text-xs text-foreground/50">
          Available: {"{{first_name}}"}, {"{{business_name}}"}, {"{{points}}"}, {"{{stamps}}"}, {"{{remaining}}"},{" "}
          {"{{reward_name}}"}, {"{{offer}}"}, {"{{expiry}}"}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="scheduledAt" className={labelClass}>
          Schedule for later (optional)
        </label>
        <input id="scheduledAt" name="scheduledAt" type="datetime-local" className={inputClass} />
        <p className="text-xs text-foreground/50">Leave blank to review and send immediately after creating.</p>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        disabled={pending}
        type="submit"
        className="w-fit rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}
