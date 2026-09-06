import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getSiteUrl } from "@/lib/site-url";
import type { WalletPassData } from "./types";

/** Shared by both the Apple and Google routes: token -> business-branded
 * pass data, using the exact same public lookup as the web card
 * (lib/public-business.ts + wallet_token), so the wallet pass and the web
 * card are always describing the same underlying state. */
export async function buildWalletPassData(token: string): Promise<WalletPassData | null> {
  const supabase = createServiceRoleClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, business_id, wallet_token")
    .eq("wallet_token", token)
    .maybeSingle();
  if (!customer) return null;

  const [{ data: business }, { data: branding }, { data: program }] = await Promise.all([
    supabase.from("businesses").select("name").eq("id", customer.business_id).single(),
    supabase.from("business_branding").select("*").eq("business_id", customer.business_id).maybeSingle(),
    supabase
      .from("loyalty_programs")
      .select("*")
      .eq("business_id", customer.business_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  let progressLabel = "Not enrolled yet";
  let hasAvailableReward = false;

  if (program) {
    const { data: account } = await supabase
      .from("loyalty_accounts")
      .select("stamps_count, points_balance")
      .eq("customer_id", customer.id)
      .eq("loyalty_program_id", program.id)
      .maybeSingle();

    if (account) {
      progressLabel =
        program.type === "STAMPS"
          ? `${account.stamps_count} / ${program.stamp_required_count}`
          : `${account.points_balance} points`;
    }

    const { count } = await supabase
      .from("rewards")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id)
      .eq("status", "AVAILABLE");
    hasAvailableReward = (count ?? 0) > 0;
  }

  const siteUrl = await getSiteUrl();

  return {
    businessName: business?.name ?? "LoyalNest",
    logoUrl: branding?.logo_url ?? null,
    primaryColor: branding?.primary_color ?? "#171717",
    backgroundColor: branding?.background_color ?? "#ffffff",
    textColor: branding?.text_color ?? "#171717",
    customerFirstName: customer.first_name,
    loyaltyProgramName: program?.name ?? null,
    loyaltyType: (program?.type as "STAMPS" | "POINTS" | undefined) ?? null,
    progressLabel,
    rewardName: program?.reward_name ?? null,
    hasAvailableReward,
    qrValue: `${siteUrl}/q/${customer.wallet_token}`,
    serialNumber: customer.id,
  };
}
