import { NextResponse } from "next/server";
import { z } from "zod";
import { buildWalletPassData } from "@/services/wallet/build-pass-data";
import { buildApplePassJson, isAppleWalletConfigured } from "@/services/wallet/apple";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!z.uuid().safeParse(token).success) {
    return NextResponse.json({ error: "Invalid card." }, { status: 400 });
  }

  if (!isAppleWalletConfigured()) {
    // EXTERNAL APPLE CERTIFICATE SETUP PENDING — see docs/integrations.md.
    return NextResponse.json(
      { error: "Apple Wallet isn't set up for this business yet.", configured: false },
      { status: 501 }
    );
  }

  const data = await buildWalletPassData(token);
  if (!data) {
    return NextResponse.json({ error: "This loyalty card couldn't be found." }, { status: 404 });
  }

  // Signing (.pkpass generation) is the remaining step once certificates
  // are configured — see services/wallet/apple.ts for exactly what's left.
  const passJson = buildApplePassJson(data);
  return NextResponse.json(
    { error: "Pass signing not yet implemented.", passJsonPreview: passJson },
    { status: 501 }
  );
}
