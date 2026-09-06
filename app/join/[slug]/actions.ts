"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { normalizePhone } from "@/lib/phone";
import { JoinFormSchema } from "@/lib/validation/join";

export type JoinState = { error?: string } | undefined;

export async function joinBusiness(_state: JoinState, formData: FormData): Promise<JoinState> {
  const slug = formData.get("businessSlug");
  if (typeof slug !== "string" || !slug) {
    return { error: "Something went wrong. Please reload the page." };
  }

  const parsed = JoinFormSchema.safeParse({
    firstName: formData.get("firstName"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    birthday: formData.get("birthday") || undefined,
    whatsappConsent: formData.get("whatsappConsent") === "on",
    smsConsent: formData.get("smsConsent") === "on",
    emailConsent: formData.get("emailConsent") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  const phoneResult = normalizePhone(parsed.data.phone);
  if (!phoneResult.valid) {
    return { error: phoneResult.error };
  }

  const supabase = createServiceRoleClient();

  const { data: business } = await supabase.from("businesses").select("id").eq("slug", slug).maybeSingle();
  if (!business) {
    return { error: "This business could not be found." };
  }

  let customerId: string;
  let isNew = false;

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("business_id", business.id)
    .eq("phone_normalized", phoneResult.e164)
    .maybeSingle();

  if (existingCustomer) {
    customerId = existingCustomer.id;
  } else {
    const { data: createdCustomer, error: createError } = await supabase
      .from("customers")
      .insert({
        business_id: business.id,
        first_name: parsed.data.firstName,
        phone_raw: parsed.data.phone,
        phone_normalized: phoneResult.e164,
        email: parsed.data.email || null,
        birthday: parsed.data.birthday || null,
        source: "JOIN_PAGE",
      })
      .select("id")
      .single();

    if (createError || !createdCustomer) {
      return { error: "We couldn't save your details. Please try again." };
    }
    customerId = createdCustomer.id;
    isNew = true;
  }

  const now = new Date().toISOString();
  const consentRows = (
    [
      ["WHATSAPP", parsed.data.whatsappConsent],
      ["SMS", parsed.data.smsConsent],
      ["EMAIL", parsed.data.emailConsent],
    ] as const
  ).map(([channel, granted]) => ({
    business_id: business.id,
    customer_id: customerId,
    channel,
    status: granted ? "GRANTED" : "REVOKED",
    consented_at: granted ? now : null,
    revoked_at: granted ? null : now,
    source: "JOIN_PAGE",
  }));

  await supabase
    .from("customer_consents")
    .upsert(consentRows, { onConflict: "business_id,customer_id,channel" });

  const { data: program } = await supabase
    .from("loyalty_programs")
    .select("id")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (program) {
    await supabase
      .from("loyalty_accounts")
      .upsert(
        { business_id: business.id, customer_id: customerId, loyalty_program_id: program.id },
        { onConflict: "customer_id,loyalty_program_id", ignoreDuplicates: true }
      );
  }

  const { data: customer } = await supabase.from("customers").select("wallet_token").eq("id", customerId).single();

  redirect(`/join/${slug}/card?token=${customer!.wallet_token}&new=${isNew ? "1" : "0"}`);
}
