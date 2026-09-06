import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Convenience redirect for phones' native camera apps: many will offer to
 * "open in browser" when a QR decodes to a URL, even though our own Staff
 * Mode scanner never navigates here — it reads the raw text client-side
 * (see lib/validation/scanner.ts). If a customer scans their own card with
 * their phone's regular camera, this sends them to their card instead of a
 * dead link.
 */
export default async function ScanRedirectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!z.uuid().safeParse(token).success) {
    notFound();
  }

  const supabase = createServiceRoleClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("business_id")
    .eq("wallet_token", token)
    .maybeSingle();

  if (!customer) {
    notFound();
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("slug")
    .eq("id", customer.business_id)
    .single();

  if (!business) {
    notFound();
  }

  redirect(`/join/${business.slug}/card?token=${token}&new=0`);
}
