import { generateQrDataUrl } from "@/lib/qr";
import { getSiteUrl } from "@/lib/site-url";
import { CopyLinkButton } from "./copy-link-button";

export async function SignupQrCard({ businessSlug }: { businessSlug: string }) {
  const siteUrl = await getSiteUrl();
  const joinUrl = `${siteUrl}/join/${businessSlug}`;
  const qrDataUrl = await generateQrDataUrl(joinUrl);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-medium">Customer signup</h2>
          <p className="text-sm text-foreground/70">
            Print this QR at the counter, or share the link — customers join your loyalty
            program in seconds, no app required.
          </p>
        </div>
        <code className="w-fit rounded bg-foreground/5 px-2 py-1 text-xs">{joinUrl}</code>
        <div className="flex gap-2">
          <CopyLinkButton link={joinUrl} />
          <a
            href={qrDataUrl}
            download={`${businessSlug}-signup-qr.png`}
            className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            Download QR
          </a>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a locally generated data: URI, not an optimizable remote image */}
      <img src={qrDataUrl} alt={`QR code linking to ${joinUrl}`} width={160} height={160} className="rounded-md border border-foreground/10" />
    </div>
  );
}
