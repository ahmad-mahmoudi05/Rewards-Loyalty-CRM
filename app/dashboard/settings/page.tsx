import { requireBusinessContext } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const membership = await requireBusinessContext();
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("name, business_type, country, currency, timezone")
    .eq("id", membership.business_id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-foreground/70">Business profile and regional defaults.</p>
      </div>

      {membership.role === "OWNER" ? (
        business && <SettingsForm business={business} />
      ) : (
        <p className="text-sm text-foreground/60">Only the owner can change business settings.</p>
      )}
    </div>
  );
}
