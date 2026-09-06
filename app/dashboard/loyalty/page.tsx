import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { LoyaltyForm } from "./loyalty-form";

export default async function LoyaltyPage() {
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const supabase = await createClient();

  const { data: program } = await supabase
    .from("loyalty_programs")
    .select("*")
    .eq("business_id", membership.business_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Loyalty</h1>
        <p className="text-sm text-foreground/70">
          {program
            ? "This configuration drives every reward calculation across your business — it applies the same way at every location."
            : "Create your loyalty program to unlock customer signup, transactions, and rewards."}
        </p>
      </div>

      <LoyaltyForm program={program ?? null} />
    </div>
  );
}
