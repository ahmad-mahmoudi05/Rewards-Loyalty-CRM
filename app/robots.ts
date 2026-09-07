import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = await getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The dashboard, onboarding, auth flows, and every customer-facing
        // per-business page (join/card/QR redirect) are session- or
        // token-scoped — none of it should ever be indexed. Only the public
        // marketing site (/, /pricing, /privacy, /terms) is crawlable.
        disallow: ["/dashboard", "/onboarding", "/login", "/signup", "/forgot-password", "/reset-password", "/invite", "/join", "/q", "/unsubscribe", "/api", "/auth"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
