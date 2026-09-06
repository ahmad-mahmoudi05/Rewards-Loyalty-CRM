import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role client: bypasses RLS entirely. Only for the specific,
 * audited server actions that must act outside a user session — the public
 * customer-signup path and the loyalty-engine RPCs (see
 * docs/architecture.md, "Two data paths"). Never import this from a Client
 * Component; the `server-only` import above throws a build error if you try.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
