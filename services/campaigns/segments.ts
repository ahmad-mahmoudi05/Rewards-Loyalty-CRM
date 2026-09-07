import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { type AudienceDefinition } from "./segment-definitions";

export { SEGMENTS, type SegmentKey, type AudienceDefinition } from "./segment-definitions";

type CustomerSummary = Database["public"]["Views"]["customer_summary"]["Row"];

/** Near-points-reward MVP rule, documented since the spec allows a
 * "reasonable default": within the last 20% of the configured threshold. */
const NEAR_POINTS_FRACTION = 0.8;

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Fetches every customer_summary row matching the segment, tenant-scoped
 * via the caller's own RLS session — never a service-role bypass. Channel-
 * specific consent/address breakdown is computed by the caller from the
 * returned rows (they already carry *_subscribed flags + email/phone). */
export async function fetchSegmentCustomers(
  supabase: SupabaseClient<Database>,
  businessId: string,
  audience: AudienceDefinition
): Promise<CustomerSummary[]> {
  let query = supabase.from("customer_summary").select("*").eq("business_id", businessId);

  switch (audience.segment) {
    case "NEW":
      query = query.gte("created_at", daysAgoIso(30));
      break;
    case "RETURNING":
      query = query.gte("transaction_count", 2);
      break;
    case "INACTIVE_14":
      query = query.or(`last_transaction_at.lt.${daysAgoIso(14)},and(last_transaction_at.is.null,created_at.lt.${daysAgoIso(14)})`);
      break;
    case "INACTIVE_30":
      query = query.or(`last_transaction_at.lt.${daysAgoIso(30)},and(last_transaction_at.is.null,created_at.lt.${daysAgoIso(30)})`);
      break;
    case "INACTIVE_60":
      query = query.or(`last_transaction_at.lt.${daysAgoIso(60)},and(last_transaction_at.is.null,created_at.lt.${daysAgoIso(60)})`);
      break;
    case "REWARD_AVAILABLE":
      query = query.gt("available_rewards_count", 0);
      break;
    case "ONE_STAMP_AWAY":
      // Can't express "stamps_count = stamp_required_count - 1" as a single
      // column filter server-side without a raw expression; filter client-side below.
      query = query.eq("loyalty_type", "STAMPS");
      break;
    case "NEAR_POINTS_REWARD":
      query = query.eq("loyalty_type", "POINTS");
      break;
    case "HIGH_SPENDER":
      query = query.gte("total_spend", audience.spendThreshold ?? 500);
      break;
    case "FREQUENT_CUSTOMER":
      query = query.gte("transaction_count", audience.visitThreshold ?? 5);
      break;
    case "WHATSAPP_SUBSCRIBED":
      query = query.eq("whatsapp_subscribed", true);
      break;
    case "SMS_SUBSCRIBED":
      query = query.eq("sms_subscribed", true);
      break;
    case "EMAIL_SUBSCRIBED":
      query = query.eq("email_subscribed", true);
      break;
    case "BIRTHDAY_MONTH":
      // Postgres month-of-date comparisons aren't expressible through
      // PostgREST filters either; filter client-side below.
      break;
    case "ALL":
    default:
      break;
  }

  const { data, error } = await query;
  if (error) throw error;
  let rows = data ?? [];

  if (audience.segment === "ONE_STAMP_AWAY") {
    rows = rows.filter((r) => r.stamps_count != null && r.stamp_required_count != null && r.stamps_count === r.stamp_required_count - 1);
  }
  if (audience.segment === "NEAR_POINTS_REWARD") {
    rows = rows.filter(
      (r) => r.points_balance != null && r.points_reward_threshold != null && r.points_balance >= r.points_reward_threshold * NEAR_POINTS_FRACTION
    );
  }
  if (audience.segment === "BIRTHDAY_MONTH") {
    const thisMonth = new Date().getMonth();
    rows = rows.filter((r) => r.birthday != null && new Date(r.birthday + "T00:00:00Z").getUTCMonth() === thisMonth);
  }

  return rows;
}

export type AudiencePreview = {
  matched: number;
  channelSubscribed: number;
  validDestination: number;
  eligible: number;
  eligibleCustomerIds: string[];
};

export function summarizeAudience(rows: CustomerSummary[], channel: "EMAIL" | "WHATSAPP" | "SMS"): AudiencePreview {
  const subscribedKey = channel === "EMAIL" ? "email_subscribed" : channel === "WHATSAPP" ? "whatsapp_subscribed" : "sms_subscribed";
  const subscribed = rows.filter((r) => r[subscribedKey]);
  const withDestination = subscribed.filter((r) => (channel === "EMAIL" ? Boolean(r.email) : Boolean(r.phone_normalized)));

  return {
    matched: rows.length,
    channelSubscribed: subscribed.length,
    validDestination: withDestination.length,
    eligible: withDestination.length,
    eligibleCustomerIds: withDestination.map((r) => r.id!).filter(Boolean),
  };
}
