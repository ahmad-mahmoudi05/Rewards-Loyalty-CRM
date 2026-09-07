import { requireBusinessContext } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { BrandingForm } from "./branding-form";

export default async function BrandingPage() {
  const membership = await requireBusinessContext();
  const supabase = await createClient();

  const { data: branding } = await supabase
    .from("business_branding")
    .select("*")
    .eq("business_id", membership.business_id)
    .single();

  const canManage = membership.role === "OWNER" || membership.role === "MANAGER";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Branding</h1>
        <p className="text-sm text-foreground/70">
          Logo and colors for your customer-facing join page, digital card, and Wallet passes.
          The LoyalNest dashboard chrome is unaffected — this only changes what your customers see.
        </p>
      </div>

      {canManage ? (
        branding ? (
          <BrandingForm branding={branding} />
        ) : (
          <p className="text-sm text-foreground/60">Branding could not be loaded.</p>
        )
      ) : (
        <p className="text-sm text-foreground/60">Only an owner or manager can edit branding.</p>
      )}
    </div>
  );
}
