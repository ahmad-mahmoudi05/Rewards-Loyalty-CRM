import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Public, unauthenticated read path for the customer-facing join/card pages.
 * Runs only in trusted server code (Server Components/Actions) using the
 * service-role client — never exposed to the browser, never backed by an
 * anon RLS policy. See docs/architecture.md, "Two data paths".
 */
export async function getPublicBusinessContext(slug: string) {
  const supabase = createServiceRoleClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, slug, business_type")
    .eq("slug", slug)
    .maybeSingle();

  if (!business) return null;

  const [{ data: branding }, { data: program }] = await Promise.all([
    supabase.from("business_branding").select("*").eq("business_id", business.id).maybeSingle(),
    supabase
      .from("loyalty_programs")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return { business, branding, program };
}

export type PublicBusinessContext = NonNullable<Awaited<ReturnType<typeof getPublicBusinessContext>>>;
