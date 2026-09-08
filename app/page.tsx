import Link from "next/link";
import { Wallet, Users, QrCode, MessageCircle, RefreshCw, BarChart3, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "Digital loyalty card",
    description:
      "Stamps or points, your rules. Customers get a shareable digital card — no app to download. Apple & Google Wallet support is coming soon.",
  },
  {
    icon: Users,
    title: "Customer CRM",
    description:
      "Every visit, purchase, and reward in one profile. See who your regulars are and who's about to churn.",
  },
  {
    icon: QrCode,
    title: "QR check-in & staff scanner",
    description: "Customers join and get scanned in seconds — on a phone camera or a USB barcode scanner at the counter.",
  },
  {
    icon: MessageCircle,
    title: "Automated WhatsApp, SMS & email",
    description:
      "Welcome messages, win-back campaigns, and birthday offers that send themselves — with consent built in.",
  },
  {
    icon: RefreshCw,
    title: "Retention automations",
    description: "Win back inactive customers, celebrate birthdays, and recognize your best regulars automatically.",
  },
  {
    icon: BarChart3,
    title: "Analytics that matter",
    description: "Repeat-visit rate, tracked revenue, and campaign performance — not vanity metrics.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="text-lg font-semibold tracking-tight">LoyalNest</span>
          <nav className="flex items-center gap-6 text-sm font-medium text-foreground/70">
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              Pricing
            </Link>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Start Free
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 py-28 text-center sm:py-36">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center"
        >
          <div className="h-[32rem] w-[64rem] rounded-full bg-foreground/[0.06] blur-3xl" />
        </div>

        <div className="mx-auto flex max-w-3xl flex-col items-center gap-7">
          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Turn first-time customers into loyal regulars
          </h1>
          <p className="max-w-xl text-balance text-lg text-foreground/70 sm:text-xl">
            Digital loyalty, customer CRM, and WhatsApp, SMS, and email marketing —
            all in one platform.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background shadow-sm transition-all hover:opacity-90 hover:shadow-md"
            >
              Start Free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-full border border-foreground/15 px-7 py-3.5 text-sm font-medium transition-colors hover:bg-foreground/5"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-foreground/10 px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col gap-4 rounded-2xl border border-foreground/10 p-6 transition-colors hover:border-foreground/20 hover:bg-foreground/[0.02]"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-foreground/10">
                  <feature.icon className="size-5" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-medium">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-foreground/70">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-foreground/10 px-6 py-20 sm:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 rounded-3xl border border-foreground/10 px-8 py-14 text-center sm:px-14">
          <p className="text-sm font-medium text-foreground/60">
            Built first for cafés — ready for padel clubs, salons, barbers, gyms, and more, with zero code changes.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background shadow-sm transition-all hover:opacity-90 hover:shadow-md"
            >
              Start Free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-foreground/15 px-7 py-3.5 text-sm font-medium transition-colors hover:bg-foreground/5"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-foreground/10 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-foreground/50 sm:flex-row">
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
