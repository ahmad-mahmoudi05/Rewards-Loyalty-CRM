"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusinessContext } from "@/lib/dal";
import { parseScannedToken, SearchCustomersSchema } from "@/lib/validation/scanner";
import type { Database } from "@/lib/supabase/database.types";

// Transaction recording and reward redemption are NOT reimplemented here —
// the scanner reuses the exact same server actions as the CRM customer
// profile (app/dashboard/customers/[customerId]/actions.ts), which already
// call the Day 2 record_transaction/redeem_reward RPCs. See
// components/dashboard/customer-operational-panel.tsx, which is shared by
// both the scanner and (eventually) any other operational entry point.

type CustomerSummary = Database["public"]["Views"]["customer_summary"]["Row"];
type Reward = Database["public"]["Tables"]["rewards"]["Row"];

export type OperationalView = {
  customer: CustomerSummary;
  rewards: Reward[];
};

export type ResolveResult = { error: string } | { view: OperationalView };

const NOT_RECOGNIZED = "This loyalty card couldn't be recognized.";

async function loadOperationalView(businessId: string, customerId: string): Promise<OperationalView | null> {
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customer_summary")
    .select("*")
    .eq("id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!customer) return null;

  const { data: rewards } = await supabase
    .from("rewards")
    .select("*")
    .eq("customer_id", customerId)
    .eq("status", "AVAILABLE")
    .order("generated_at", { ascending: true });

  return { customer, rewards: rewards ?? [] };
}

/**
 * Resolves a scanned QR (or a bare token) to a customer, scoped to the
 * staff member's own business. Deliberately generic on failure — whether
 * the token is malformed, doesn't exist, or belongs to another tenant, the
 * caller sees the same message (Part 24: never confirm that a token
 * belongs to *some other* business).
 */
export async function resolveCustomerByToken(rawScanned: string): Promise<ResolveResult> {
  const membership = await requireBusinessContext();

  const token = parseScannedToken(rawScanned);
  if (!token) {
    return { error: NOT_RECOGNIZED };
  }

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("wallet_token", token)
    .eq("business_id", membership.business_id)
    .maybeSingle();

  if (!customer) {
    return { error: NOT_RECOGNIZED };
  }

  const view = await loadOperationalView(membership.business_id, customer.id);
  if (!view) return { error: NOT_RECOGNIZED };
  return { view };
}

export type SearchResult = { id: string; label: string; phone: string };

export async function searchCustomers(rawQuery: string): Promise<SearchResult[]> {
  const membership = await requireBusinessContext();

  const parsed = SearchCustomersSchema.safeParse({ query: rawQuery });
  if (!parsed.success) return [];

  const supabase = await createClient();
  const term = parsed.data.query;
  const { data } = await supabase
    .from("customer_summary")
    .select("id, first_name, last_name, phone_normalized, email")
    .eq("business_id", membership.business_id)
    .or(`first_name.ilike.%${term}%,phone_normalized.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(10);

  return (data ?? [])
    .filter((c): c is typeof c & { id: string } => c.id !== null)
    .map((c) => ({
      id: c.id,
      label: `${c.first_name} ${c.last_name ?? ""}`.trim(),
      phone: c.phone_normalized ?? "",
    }));
}

export async function getOperationalView(customerId: string): Promise<ResolveResult> {
  const membership = await requireBusinessContext();
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) {
    return { error: NOT_RECOGNIZED };
  }
  const view = await loadOperationalView(membership.business_id, customerId);
  if (!view) return { error: NOT_RECOGNIZED };
  return { view };
}
