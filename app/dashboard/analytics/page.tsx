import { requireRole } from "@/lib/dal";
import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default async function AnalyticsPage() {
  await requireRole(["OWNER", "MANAGER"]);

  return (
    <PlaceholderPage
      title="Analytics"
      description="Customer growth, repeat-visit rate, tracked revenue, reward redemptions, and campaign performance, filterable by date range and location."
      plannedFor="Planned for Day 5."
    />
  );
}
