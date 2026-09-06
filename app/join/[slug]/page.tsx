import { notFound } from "next/navigation";
import { getPublicBusinessContext } from "@/lib/public-business";
import { JoinForm } from "./join-form";

function loyaltyExplanation(program: NonNullable<Awaited<ReturnType<typeof getPublicBusinessContext>>>["program"]) {
  if (!program) return null;
  const requirement =
    program.type === "STAMPS"
      ? `${program.stamp_required_count} qualifying visit${program.stamp_required_count === 1 ? "" : "s"}`
      : `${program.points_reward_threshold} points`;
  return `Earn ${requirement} and receive ${program.reward_name}.`;
}

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await getPublicBusinessContext(slug);

  if (!context) {
    notFound();
  }

  const { business, branding, program } = context;
  const backgroundColor = branding?.background_color ?? "#ffffff";
  const textColor = branding?.text_color ?? "#171717";
  const accentColor = branding?.primary_color ?? "#171717";
  const explanation = loyaltyExplanation(program);

  return (
    <main
      className="flex min-h-screen flex-col items-center px-6 py-12"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- business-supplied external logo, not a local optimizable asset
            <img src={branding.logo_url} alt={business.name} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {business.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-semibold">{business.name} Rewards</h1>
          {explanation && <p className="text-sm opacity-70">{explanation}</p>}
          {!program && (
            <p className="text-sm opacity-70">Join now — {business.name} will let you know when rewards open up.</p>
          )}
        </div>

        <JoinForm slug={slug} accentColor={accentColor} />

        <p className="text-center text-xs opacity-50">Powered by LoyalNest</p>
      </div>
    </main>
  );
}
