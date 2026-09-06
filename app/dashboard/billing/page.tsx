import { requireRole } from "@/lib/dal";
import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default async function BillingPage() {
  await requireRole(["OWNER"]);

  return (
    <PlaceholderPage
      title="Billing"
      description="Your plan, usage, and payment method via Stripe Checkout and the Customer Portal. Owner only — not visible to managers or staff."
      plannedFor="Planned for Day 5."
    />
  );
}
