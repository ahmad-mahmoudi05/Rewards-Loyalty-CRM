import Link from "next/link";

const features = [
  {
    title: "Digital loyalty & Wallet passes",
    description:
      "Stamps or points, your rules. Customers carry their card in Apple or Google Wallet — no app to download.",
  },
  {
    title: "Customer CRM",
    description:
      "Every visit, purchase, and reward in one profile. See who your regulars are and who's about to churn.",
  },
  {
    title: "Automated WhatsApp, SMS & email",
    description:
      "Welcome messages, win-back campaigns, and birthday offers that send themselves — with consent built in.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">LoyalNest</span>
        <Link
          href="/login"
          className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
        >
          Log in
        </Link>
      </header>

      <section className="flex flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Turn first-time customers into loyal regulars
        </h1>
        <p className="max-w-xl text-base text-foreground/70 sm:text-lg">
          Digital loyalty, customer CRM, Wallet passes, and automated WhatsApp, SMS, and
          email marketing — all in one platform.
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
    </main>
  );
}
