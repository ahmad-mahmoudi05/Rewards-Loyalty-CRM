import type { Metadata } from "next";
import { requireBusinessContext } from "@/lib/dal";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { getEntitlements } from "@/lib/entitlements";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireBusinessContext();
  const entitlements = await getEntitlements(membership.business_id);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col justify-between border-b border-foreground/10 px-4 py-4 md:w-60 md:border-b-0 md:border-r md:py-6">
        <div className="flex flex-col gap-3 md:gap-6">
          <div className="flex flex-col gap-0.5 px-3">
            <span className="text-sm font-semibold tracking-tight">LoyalNest</span>
            <span className="truncate text-xs text-foreground/60">{membership.business.name}</span>
          </div>
          <SidebarNav />
        </div>

        <LogoutButton />
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <TrialBanner entitlements={entitlements} role={membership.role} />
        {children}
      </main>
    </div>
  );
}
