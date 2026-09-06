import { requireBusinessContext } from "@/lib/dal";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { logout } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireBusinessContext();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col justify-between border-r border-foreground/10 px-4 py-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-0.5 px-3">
            <span className="text-sm font-semibold tracking-tight">LoyalNest</span>
            <span className="truncate text-xs text-foreground/60">{membership.business.name}</span>
          </div>
          <SidebarNav />
        </div>

        <form action={logout} className="px-3">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            Log out
          </button>
        </form>
      </aside>

      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
