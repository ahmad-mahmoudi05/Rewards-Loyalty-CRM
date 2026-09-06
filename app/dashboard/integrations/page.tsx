import { requireRole } from "@/lib/dal";
import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default async function IntegrationsPage() {
  await requireRole(["OWNER", "MANAGER"]);

  return (
    <PlaceholderPage
      title="Integrations"
      description="Connect WhatsApp, SMS, and email so campaigns and automations can send. Owner/manager only — never visible to staff."
      plannedFor="Planned for Day 4. See docs/integrations.md for provider setup status."
    />
  );
}
