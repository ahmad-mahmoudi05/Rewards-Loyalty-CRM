import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getPublicBusinessContext } from "@/lib/public-business";
import { generateQrDataUrl } from "@/lib/qr";
import { getSiteUrl } from "@/lib/site-url";
import { WalletButtons } from "./wallet-buttons";

export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; new?: string }>;
}) {
  const { slug } = await params;
  const { token, new: isNew } = await searchParams;

  const context = await getPublicBusinessContext(slug);
  if (!context || !token) {
    notFound();
  }
  const { business, branding, program } = context;

  const supabase = createServiceRoleClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, wallet_token, updated_at")
    .eq("business_id", business.id)
    .eq("wallet_token", token)
    .maybeSingle();

  if (!customer) {
    notFound();
  }

  let progressLabel: string | null = null;
  let remainingLabel: string | null = null;
  let availableRewards: { id: string; name: string; expires_at: string | null }[] = [];
  let lastUpdated: string | null = null;

  if (program) {
    const { data: account } = await supabase
      .from("loyalty_accounts")
      .select("stamps_count, points_balance, updated_at")
      .eq("customer_id", customer.id)
      .eq("loyalty_program_id", program.id)
      .maybeSingle();

    if (account) {
      lastUpdated = account.updated_at;
      if (program.type === "STAMPS") {
        progressLabel = `${account.stamps_count} / ${program.stamp_required_count}`;
        const remaining = (program.stamp_required_count ?? 0) - (account.stamps_count ?? 0);
        if (remaining > 0) remainingLabel = `${remaining} more until ${program.reward_name}`;
      } else {
        progressLabel = `${account.points_balance} points`;
        const remaining = (program.points_reward_threshold ?? 0) - (account.points_balance ?? 0);
        if (remaining > 0) remainingLabel = `${remaining} points until ${program.reward_name}`;
      }
    }

    const { data: rewards } = await supabase
      .from("rewards")
      .select("id, name, expires_at")
      .eq("customer_id", customer.id)
      .eq("status", "AVAILABLE");
    availableRewards = rewards ?? [];
  }

  const siteUrl = await getSiteUrl();
  const qrDataUrl = await generateQrDataUrl(`${siteUrl}/q/${customer.wallet_token}`);

  const backgroundColor = branding?.background_color ?? "#ffffff";
  const textColor = branding?.text_color ?? "#171717";
  const accentColor = branding?.primary_color ?? "#171717";

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- business-supplied external logo
            <img src={branding.logo_url} alt={business.name} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {business.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <p className="text-xs uppercase tracking-wide opacity-60">
            {isNew === "0" ? "Welcome back to" : "Welcome to"}
          </p>
          <h1 className="text-2xl font-semibold">{business.name} Rewards</h1>
        </div>

        <div className="rounded-2xl border p-6" style={{ borderColor: `${textColor}22` }}>
          <p className="text-lg font-medium">{customer.first_name}</p>
          {program && <p className="text-xs opacity-60">{program.name}</p>}

          {availableRewards.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              {availableRewards.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  🎉 {r.name} is ready to redeem — show this screen to staff.
                </div>
              ))}
            </div>
          ) : progressLabel ? (
            <div className="mt-4">
              <p className="text-3xl font-semibold">{progressLabel}</p>
              {remainingLabel && <p className="mt-1 text-sm opacity-70">{remainingLabel}</p>}
            </div>
          ) : (
            <p className="mt-4 text-sm opacity-70">
              Your rewards will appear here as soon as {business.name} sets them up.
            </p>
          )}

          <div className="mt-6 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- locally generated data: URI */}
            <img
              src={qrDataUrl}
              alt="Your loyalty QR code"
              width={200}
              height={200}
              className="rounded-lg border"
              style={{ borderColor: `${textColor}22` }}
            />
          </div>
          <p className="mt-2 text-xs opacity-60">Show this QR to staff at checkout.</p>
        </div>

        <WalletButtons token={customer.wallet_token} />

        {lastUpdated && (
          <p className="text-xs opacity-40">Last updated {new Date(lastUpdated).toLocaleString()}</p>
        )}
        <p className="text-xs opacity-50">Powered by LoyalNest</p>
      </div>
    </main>
  );
}
