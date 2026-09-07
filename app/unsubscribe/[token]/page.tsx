import { notFound } from "next/navigation";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { UnsubscribeButton } from "./unsubscribe-button";

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!z.uuid().safeParse(token).success) notFound();

  const supabase = createServiceRoleClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("first_name, business_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (!customer) notFound();

  const { data: business } = await supabase.from("businesses").select("name").eq("id", customer.business_id).single();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div>
        <h1 className="text-xl font-semibold">Unsubscribe from {business?.name}</h1>
        <p className="mt-2 text-sm text-foreground/70">
          You&apos;ll stop receiving marketing emails from {business?.name}. This won&apos;t
          affect your loyalty progress.
        </p>
      </div>
      <UnsubscribeButton token={token} businessName={business?.name ?? "this business"} />
    </main>
  );
}
