import "server-only";
import { WalletNotConfiguredError, type WalletPassData } from "./types";

/**
 * Apple Wallet integration status: CODE COMPLETE (payload mapping) /
 * EXTERNAL APPLE CERTIFICATE SETUP PENDING (signing). See docs/integrations.md.
 *
 * What's real here: `buildPassJson` produces a spec-correct Apple Wallet
 * "generic"/"storeCard" pass.json payload (https://developer.apple.com/documentation/walletpasses)
 * from our own data — this part is testable and correct with zero external
 * dependencies.
 *
 * What's NOT implemented: turning that JSON into a signed .pkpass (a ZIP of
 * pass.json + a manifest.json of SHA-1 hashes + a PKCS#7 detached signature
 * over the manifest, produced with an Apple-issued Pass Type ID certificate
 * and the Apple WWDR intermediate certificate). That step needs real
 * certificates this environment doesn't have, and shipping a signing
 * function no one can run or verify would just be an untested black box —
 * worse than being explicit that it's the next step. The `passkit-generator`
 * npm package is the recommended library once certificates exist (see
 * docs/integrations.md for the exact env vars and setup path).
 */

export function isAppleWalletConfigured(): boolean {
  return Boolean(
    process.env.APPLE_TEAM_ID &&
      process.env.APPLE_PASS_TYPE_ID &&
      process.env.APPLE_WWDR_CERT &&
      process.env.APPLE_SIGNER_CERT &&
      process.env.APPLE_SIGNER_KEY
  );
}

export function buildApplePassJson(data: WalletPassData) {
  if (!isAppleWalletConfigured()) {
    throw new WalletNotConfiguredError("apple");
  }

  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    organizationName: data.businessName,
    serialNumber: data.serialNumber,
    description: `${data.businessName} loyalty card`,
    logoText: data.businessName,
    backgroundColor: hexToRgbString(data.backgroundColor),
    foregroundColor: hexToRgbString(data.textColor),
    labelColor: hexToRgbString(data.primaryColor),
    storeCard: {
      headerFields: [{ key: "program", label: data.loyaltyProgramName ?? "Loyalty", value: "" }],
      primaryFields: [{ key: "balance", label: "Balance", value: data.progressLabel }],
      secondaryFields: [{ key: "name", label: "Member", value: data.customerFirstName }],
      backFields: data.hasAvailableReward && data.rewardName
        ? [{ key: "reward", label: "Available reward", value: data.rewardName }]
        : [],
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: data.qrValue,
        messageEncoding: "iso-8859-1",
      },
    ],
  };
}

function hexToRgbString(hex: string) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgb(${r}, ${g}, ${b})`;
}
