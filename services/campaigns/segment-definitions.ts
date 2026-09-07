// Deliberately has no "server-only" import — this is the pure, static
// segment catalog shared by both server code (services/campaigns/segments.ts,
// which does the actual DB queries) and client components (the campaign
// builder form, which only needs the list of options + labels).

export const SEGMENTS = [
  { key: "ALL", label: "All customers" },
  { key: "NEW", label: "New (joined last 30 days)" },
  { key: "RETURNING", label: "Returning (2+ visits)" },
  { key: "INACTIVE_14", label: "Inactive 14 days" },
  { key: "INACTIVE_30", label: "Inactive 30 days" },
  { key: "INACTIVE_60", label: "Inactive 60 days" },
  { key: "REWARD_AVAILABLE", label: "Reward available" },
  { key: "ONE_STAMP_AWAY", label: "One stamp away" },
  { key: "NEAR_POINTS_REWARD", label: "Near points reward" },
  { key: "HIGH_SPENDER", label: "High spender", configurable: { field: "spendThreshold", label: "Minimum total spend", default: 500 } },
  { key: "FREQUENT_CUSTOMER", label: "Frequent customer", configurable: { field: "visitThreshold", label: "Minimum visits", default: 5 } },
  { key: "WHATSAPP_SUBSCRIBED", label: "WhatsApp subscribed" },
  { key: "SMS_SUBSCRIBED", label: "SMS subscribed" },
  { key: "EMAIL_SUBSCRIBED", label: "Email subscribed" },
  { key: "BIRTHDAY_MONTH", label: "Birthday this month" },
] as const;

export type SegmentKey = (typeof SEGMENTS)[number]["key"];

export type AudienceDefinition = {
  segment: SegmentKey;
  spendThreshold?: number;
  visitThreshold?: number;
};
