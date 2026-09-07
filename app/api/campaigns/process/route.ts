import { NextResponse, type NextRequest } from "next/server";
import { processQueuedCampaigns } from "@/services/campaigns/process";

/**
 * The durability safety net for the campaign queue: the actual send is
 * normally kicked off immediately via `after()` right when a campaign is
 * sent (see app/dashboard/campaigns/actions.ts), so the owner never waits
 * on it. This route exists for everything `after()` can't cover — a
 * SCHEDULED campaign whose time arrives later, or picking back up any
 * recipient left QUEUED if a previous run was interrupted. Configure a
 * platform cron (Vercel Cron via vercel.json, e.g. every minute) to hit
 * this route in production.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await processQueuedCampaigns();
  return NextResponse.json(result);
}
