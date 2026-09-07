import Link from "next/link";
import type { Entitlements } from "@/lib/entitlements";

/**
 * The visible half of the Day 5 trial/billing gate — the invisible half
 * (rejecting the actual write) lives server-side in the affected actions
 * (record_transaction, campaign send, automation enable — see
 * lib/entitlements.ts::billingGateMessage). This banner is purely
 * informational; it never gates anything by itself.
 */
export function TrialBanner({ entitlements, role }: { entitlements: Entitlements; role: string }) {
  const canManageBilling = role === "OWNER";

  if (entitlements.isTrialExpired) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900">
        <span>
          {entitlements.status === "TRIALING" ? "Your trial has ended." : "Your subscription needs attention."} Business
          actions (recording purchases, sending campaigns, automations) are paused until you upgrade.
        </span>
        {canManageBilling && (
          <Link href="/dashboard/billing" className="shrink-0 rounded-full bg-red-900 px-4 py-1.5 font-medium text-white hover:opacity-90">
            Upgrade now
          </Link>
        )}
      </div>
    );
  }

  if (entitlements.isTrialing && entitlements.trialDaysRemaining !== null && entitlements.trialDaysRemaining <= 5) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <span>
          Trial ends in {entitlements.trialDaysRemaining} day{entitlements.trialDaysRemaining === 1 ? "" : "s"}.
        </span>
        {canManageBilling && (
          <Link href="/dashboard/billing" className="shrink-0 rounded-full bg-blue-900 px-4 py-1.5 font-medium text-white hover:opacity-90">
            Upgrade now
          </Link>
        )}
      </div>
    );
  }

  return null;
}
