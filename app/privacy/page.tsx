import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — LoyalNest",
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm font-medium text-foreground/60 hover:text-foreground">
        ← LoyalNest
      </Link>
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>

      <p className="rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
        <strong>Launch placeholder — not a substitute for legal review.</strong> This page
        describes, in plain language, what data LoyalNest collects and why, so the structure is
        in place before commercial launch. It has not been reviewed by a lawyer and makes no
        binding legal commitments. Replace this content with a properly drafted policy before
        broad commercial launch, particularly before processing customer data outside the UAE
        or at meaningful scale.
      </p>

      <section className="flex flex-col gap-3 text-sm text-foreground/80">
        <h2 className="text-lg font-medium text-foreground">What we collect</h2>
        <p>
          For business owners/staff: account email, name, and role. For a business&apos;s own
          customers (collected by that business, not by LoyalNest directly): first name, phone
          number, optionally email and birthday, and marketing consent choices per channel
          (WhatsApp/SMS/email), captured explicitly at signup — see the public join page.
        </p>
        <h2 className="text-lg font-medium text-foreground">How data is isolated</h2>
        <p>
          Each business&apos;s data (customers, transactions, loyalty balances, campaigns) is
          isolated from every other business on the platform via database-level access
          control (Row Level Security) — see <code>docs/database.md</code> for the technical
          detail, verified with live cross-tenant attack tests each build session (see{" "}
          <code>docs/progress.md</code>).
        </p>
        <h2 className="text-lg font-medium text-foreground">Marketing consent</h2>
        <p>
          A customer&apos;s consent is tracked per channel and can be withdrawn at any time —
          email campaigns include an unsubscribe link, and replying STOP to WhatsApp/SMS
          revokes that channel&apos;s consent automatically.
        </p>
        <h2 className="text-lg font-medium text-foreground">Data deletion</h2>
        <p>
          A business owner can request deletion or anonymization of a customer&apos;s record by
          contacting LoyalNest support. See <code>docs/database.md</code> for the current,
          documented state of this process.
        </p>
        <h2 className="text-lg font-medium text-foreground">Contact</h2>
        <p>Questions about this policy: contact the business you&apos;re a customer of, or LoyalNest support.</p>
      </section>
    </main>
  );
}
