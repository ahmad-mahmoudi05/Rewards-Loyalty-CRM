export const CUSTOMER_FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New (30d)" },
  { value: "returning", label: "Returning" },
  { value: "reward_available", label: "Reward available" },
  { value: "whatsapp", label: "WhatsApp subscribed" },
  { value: "sms", label: "SMS subscribed" },
  { value: "email", label: "Email subscribed" },
  { value: "inactive", label: "Inactive (30d)" },
] as const;

export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number]["value"];
