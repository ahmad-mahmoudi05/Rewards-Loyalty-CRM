import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Business = Database["public"]["Tables"]["businesses"]["Row"];
type BusinessMember = Database["public"]["Tables"]["business_members"]["Row"];

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * A user can belong to more than one business (business_members supports it),
 * but there is no "switch business" UI yet — Day 1 scope picks the most
 * recently joined membership as the active one. See docs/database.md.
 *
 * Reuses `getCurrentUser()` (the `cache()`-wrapped version) instead of
 * calling `supabase.auth.getUser()` again directly — this used to be a
 * second, redundant auth-revalidation network round trip on every single
 * dashboard navigation (measured live: ~200-240ms each, see docs/progress.md
 * "Session 9" for the full before/after). `requireBusinessContext()` always
 * calls `requireUser()` (which resolves `getCurrentUser()`) immediately
 * before this, so by the time this function runs the cache is already warm
 * within the current request — this doesn't skip verification, it reuses
 * the verification that already happened once, same as any other call to a
 * `cache()`-wrapped function within one request/render.
 */
export const getCurrentBusinessMembership = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("business_members")
    .select("*, business:businesses(*)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as (BusinessMember & { business: Business }) | null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireBusinessContext() {
  await requireUser();
  const membership = await getCurrentBusinessMembership();
  if (!membership) redirect("/onboarding");
  return membership;
}

/**
 * Page-level role gate for staff-restricted sections (billing, integrations,
 * analytics, ...). RLS already keeps the underlying data safe even if this
 * is skipped, but the spec calls for direct-URL access itself to be
 * rejected, not just left showing empty data. Redirects rather than
 * rendering a 403 — deliberately simple for Day 3 scope.
 */
export async function requireRole(allowedRoles: Array<"OWNER" | "MANAGER" | "STAFF">) {
  const membership = await requireBusinessContext();
  if (!allowedRoles.includes(membership.role as "OWNER" | "MANAGER" | "STAFF")) {
    redirect("/dashboard");
  }
  return membership;
}
