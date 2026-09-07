import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : undefined,
  title: {
    default: "LoyalNest — Turn first-time customers into loyal regulars",
    template: "%s",
  },
  description: "Digital loyalty, customer CRM, Wallet passes, and automated WhatsApp, SMS, and email marketing — all in one platform.",
  openGraph: {
    title: "LoyalNest",
    description: "Turn first-time customers into loyal regulars.",
    type: "website",
    siteName: "LoyalNest",
  },
  twitter: {
    card: "summary",
    title: "LoyalNest",
    description: "Turn first-time customers into loyal regulars.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
