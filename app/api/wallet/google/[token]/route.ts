import { NextResponse } from "next/server";
import { z } from "zod";
import { buildWalletPassData } from "@/services/wallet/build-pass-data";
import { buildLoyaltyObject, isGoogleWalletConfigured } from "@/services/wallet/google";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!z.uuid().safeParse(token).success) {
    return NextResponse.json({ error: "Invalid card." }, { status: 400 });
  }

  if (!isGoogleWalletConfigured()) {
    // EXTERNAL GOOGLE WALLET API SETUP PENDING — see docs/integrations.md.
    return NextResponse.json(
      { error: "Google Wallet isn't set up for this business yet.", configured: false },
      { status: 501 }
    );
  }

  const data = await buildWalletPassData(token);
  if (!data) {
    return NextResponse.json({ error: "This loyalty card couldn't be found." }, { status: 404 });
  }

  // JWT signing with the Google service account key is the remaining step
  // once credentials are configured — see services/wallet/google.ts.
  const loyaltyObject = buildLoyaltyObject(data, token);
  return NextResponse.json(
    { error: "JWT signing not yet implemented.", loyaltyObjectPreview: loyaltyObject },
    { status: 501 }
  );
}
