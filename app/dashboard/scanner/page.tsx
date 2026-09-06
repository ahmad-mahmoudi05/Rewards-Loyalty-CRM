import { requireBusinessContext } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { StaffModeClient } from "./staff-mode-client";

export default async function ScannerPage() {
  const membership = await requireBusinessContext();
  const supabase = await createClient();

  const [{ data: locations }, { data: transactions }] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name, is_primary")
      .eq("business_id", membership.business_id)
      .order("is_primary", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, total, created_at, customer:customers(first_name, last_name)")
      .eq("business_id", membership.business_id)
      .eq("status", "COMPLETED")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const recentTransactions = (transactions ?? []).map((t) => ({
    id: t.id,
    customerName: `${t.customer?.first_name ?? "Unknown"} ${t.customer?.last_name ?? ""}`.trim(),
    total: String(t.total),
    createdAt: new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));

  return (
    <StaffModeClient
      businessId={membership.business_id}
      locations={locations ?? []}
      currency={membership.business.currency}
      staffLabel={`Signed in — ${membership.role}`}
      recentTransactions={recentTransactions}
    />
  );
}
