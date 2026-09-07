import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — LoyalNest",
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm font-medium text-foreground/60 hover:text-foreground">
        ← LoyalNest
      </Link>
      <h1 className="text-3xl font-semibold">Terms of Service</h1>

      <p className="rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
        <strong>Launch placeholder — not a substitute for legal review.</strong> This page states
        the basic commercial terms (plans, trial, billing, cancellation) in plain language so the
        structure exists before commercial launch. It has not been reviewed by a lawyer and does
        not constitute a binding legal contract as written. Replace with properly drafted terms
        before broad commercial launch.
      </p>

      <section className="flex flex-col gap-3 text-sm text-foreground/80">
        <h2 className="text-lg font-medium text-foreground">Plans and trial</h2>
        <p>
          New businesses get a 14-day free trial of their chosen plan, no payment required to
          start. See <Link href="/pricing" className="underline underline-offset-2">Pricing</Link>{" "}
          for current plans and prices, which are configurable and may change.
        </p>
        <h2 className="text-lg font-medium text-foreground">Billing</h2>
        <p>
          Paid subscriptions are billed monthly via Stripe. You can view your plan, invoices, and
          payment method, and cancel at any time, from Billing in your dashboard.
        </p>
        <h2 className="text-lg font-medium text-foreground">Cancellation</h2>
        <p>
          Cancelling stops future billing at the end of the current period. Your data is not
          deleted on cancellation.
        </p>
        <h2 className="text-lg font-medium text-foreground">Acceptable use</h2>
        <p>
          Marketing messages must respect the recipient&apos;s consent choices; LoyalNest enforces
          this technically (consent checks before every send, automatic opt-out handling) but
          the business remains responsible for the content it sends.
        </p>
        <h2 className="text-lg font-medium text-foreground">Contact</h2>
        <p>Questions about these terms: contact LoyalNest support.</p>
      </section>
    </main>
  );
}
