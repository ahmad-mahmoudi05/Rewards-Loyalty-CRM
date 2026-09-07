"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type UnsubscribeState = { error?: string; success?: boolean } | undefined;

export async function confirmUnsubscribe(
  token: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, ...) call signature
  _state: UnsubscribeState
): Promise<UnsubscribeState> {
  if (!z.uuid().safeParse(token).success) {
    return { error: "This unsubscribe link is invalid." };
  }

  const ip = getClientIp(await headers());
  if (!checkRateLimit("unsubscribe", ip, 20, 60 * 60_000).allowed) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = createServiceRoleClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, business_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (!customer) {
    return { error: "This unsubscribe link is invalid." };
  }

  await supabase.from("customer_consents").upsert(
    {
      business_id: customer.business_id,
      customer_id: customer.id,
      channel: "EMAIL",
      status: "REVOKED",
      revoked_at: new Date().toISOString(),
      source: "UNSUBSCRIBE_LINK",
    },
    { onConflict: "business_id,customer_id,channel" }
  );

  return { success: true };
}
