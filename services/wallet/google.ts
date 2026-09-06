import "server-only";
import { WalletNotConfiguredError, type WalletPassData } from "./types";

/**
 * Google Wallet integration status: CODE COMPLETE (object payload mapping) /
 * EXTERNAL GOOGLE WALLET API SETUP PENDING (issuer account + signing). See
 * docs/integrations.md.
 *
 * Google Wallet works differently from Apple: there's no file to sign.
 * Instead you (1) create a "Loyalty Class" once per business via the Google
 * Wallet REST API using a Google Cloud service account, then (2) build a
 * "Loyalty Object" (the actual card data below) and wrap it in a JWT signed
 * with that same service account's private key. The resulting
 * `https://pay.google.com/gp/v/save/<jwt>` link IS the "Add to Google
 * Wallet" button target.
 *
 * What's real here: `buildLoyaltyObject` produces a spec-correct Loyalty
 * Object payload (https://developers.google.com/wallet/retail/loyalty-cards/qr-code/rest)
 * from our own data. What's NOT implemented: creating the Loyalty Class
 * (one-time, per business, requires a real Google Cloud project + service
 * account) and signing the JWT (the `google-auth-library` package's
 * `GoogleAuth` / `JWT` client is the recommended tool once credentials
 * exist — see docs/integrations.md for exact setup steps).
 */

export function isGoogleWalletConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY
  );
}

export function buildLoyaltyObject(data: WalletPassData, objectId: string) {
  if (!isGoogleWalletConfigured()) {
    throw new WalletNotConfiguredError("google");
  }

  return {
    id: `${process.env.GOOGLE_WALLET_ISSUER_ID}.${objectId}`,
    classId: `${process.env.GOOGLE_WALLET_ISSUER_ID}.${slugifyClassId(data.businessName)}`,
    state: "ACTIVE",
    accountName: data.customerFirstName,
    accountId: data.serialNumber,
    loyaltyPoints: {
      label: data.loyaltyProgramName ?? "Loyalty",
      balance: { string: data.progressLabel },
    },
    barcode: {
      type: "QR_CODE",
      value: data.qrValue,
    },
    hexBackgroundColor: data.backgroundColor,
    textModulesData: data.hasAvailableReward && data.rewardName
      ? [{ header: "Available reward", body: data.rewardName }]
      : [],
  };
}

function slugifyClassId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}
