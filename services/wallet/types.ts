import "server-only";

/** The data a wallet pass (Apple or Google) needs to render — mapped once
 * from our own tables so both providers' payload builders share one shape. */
export type WalletPassData = {
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  customerFirstName: string;
  loyaltyProgramName: string | null;
  loyaltyType: "STAMPS" | "POINTS" | null;
  progressLabel: string; // e.g. "4 / 5" or "320 points"
  rewardName: string | null;
  hasAvailableReward: boolean;
  qrValue: string; // the /q/[token] URL — same identity the web card uses
  serialNumber: string; // stable per customer, used as the pass's serialNumber
};

export class WalletNotConfiguredError extends Error {
  constructor(public provider: "apple" | "google") {
    super(`${provider} Wallet is not configured for this environment.`);
  }
}
