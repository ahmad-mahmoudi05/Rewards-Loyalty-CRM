import Link from "next/link";

const features = [
  {
    title: "Digital loyalty card",
    description:
      "Stamps or points, your rules. Customers get a shareable digital card — no app to download. Apple & Google Wallet support is coming soon.",
  },
  {
    title: "Customer CRM",
    description:
      "Every visit, purchase, and reward in one profile. See who your regulars are and who's about to churn.",
  },
  {
    title: "QR check-in & staff scanner",
    description: "Customers join and get scanned in seconds — on a phone camera or a USB barcode scanner at the counter.",
  },
  {
    title: "Automated WhatsApp, SMS & email",
    description:
      "Welcome messages, win-back campaigns, and birthday offers that send themselves — with consent built in.",
  },
  {
    title: "Retention automations",
    description: "Win back inactive customers, celebrate birthdays, and recognize your best regulars automatically.",
  },
  {
    title: "Analytics that matter",
    description: "Repeat-visit rate, tracked revenue, and campaign performance — not vanity metrics.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">LoyalNest</span>
        <nav className="flex items-center gap-6 text-sm font-medium text-foreground/70">
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Log in
          </Link>
        </nav>
      </header>

      <section className="flex flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Turn first-time customers into loyal regulars
        </h1>
        <p className="max-w-xl text-base text-foreground/70 sm:text-lg">
          Digital loyalty, customer CRM, and WhatsApp, SMS, and email marketing —
          all in one platform.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Start Free
          </Link>
          <Link
            href="#how-it-works"
            className="rounded-full border border-foreground/15 px-6 py-3 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            See How It Works
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-foreground/10 px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-2">
              <h2 className="text-lg font-medium">{feature.title}</h2>
              <p className="text-sm text-foreground/70">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-foreground/10 px-6 py-20 text-center">
        <p className="text-sm font-medium text-foreground/50">Built first for cafés — ready for padel clubs, salons, barbers, gyms, and more, with zero code changes.</p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/pricing"
            className="rounded-full border border-foreground/15 px-6 py-3 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            See pricing
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Start Free
          </Link>
        </div>
      </section>

      <footer className="mt-auto border-t border-foreground/10 px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-xs text-foreground/50 sm:flex-row">
          <span>© {new Date().getFullYear()} LoyalNest</span>
          <div className="flex gap-5">
            <Link href="/pricing" className="hover:text-foreground/80">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-foreground/80">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground/80">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
