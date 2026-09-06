import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getPublicBusinessContext } from "@/lib/public-business";

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
    .select("id, first_name, wallet_token")
    .eq("business_id", business.id)
    .eq("wallet_token", token)
    .maybeSingle();

  if (!customer) {
    notFound();
  }

  let progressLabel: string | null = null;
  let availableRewards: { id: string; name: string }[] = [];

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
          : `${account.points_balance} / ${program.points_reward_threshold} points`;
    }

    const { data: rewards } = await supabase
      .from("rewards")
      .select("id, name")
      .eq("customer_id", customer.id)
      .eq("status", "AVAILABLE");
    availableRewards = rewards ?? [];
  }

  const backgroundColor = branding?.background_color ?? "#ffffff";
  const textColor = branding?.text_color ?? "#171717";
  const accentColor = branding?.primary_color ?? "#171717";

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-60">
            {isNew === "0" ? "Welcome back to" : "Welcome to"}
          </p>
          <h1 className="text-2xl font-semibold">{business.name} Rewards</h1>
        </div>

        <div className="rounded-2xl border p-6" style={{ borderColor: `${textColor}22` }}>
          <p className="text-lg font-medium">{customer.first_name}</p>

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
              {program && (
                <p className="mt-1 text-sm opacity-70">
                  until <strong>{program.reward_name}</strong>
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm opacity-70">
              Your rewards will appear here as soon as {business.name} sets them up.
            </p>
          )}
        </div>

        <p className="text-xs opacity-60">
          Bookmark this page — show it to staff at checkout to record your visit.
        </p>
        <p className="text-xs opacity-50">Powered by LoyalNest</p>
      </div>
    </main>
  );
}
