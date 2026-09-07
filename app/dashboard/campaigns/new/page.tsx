import { requireRole } from "@/lib/dal";
import { CampaignForm } from "./campaign-form";

export default async function NewCampaignPage() {
  await requireRole(["OWNER", "MANAGER"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Create campaign</h1>
        <p className="text-sm text-foreground/70">
          You&apos;ll see exactly how many eligible, opted-in customers will receive this
          before it sends.
        </p>
      </div>
      <CampaignForm />
    </div>
  );
}
