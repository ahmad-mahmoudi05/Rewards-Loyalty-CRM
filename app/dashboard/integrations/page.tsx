import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { ConnectWhatsAppForm } from "@/components/dashboard/integrations/connect-whatsapp-form";
import { ConnectTwilioForm } from "@/components/dashboard/integrations/connect-twilio-form";
import { ActionButton } from "@/components/dashboard/integrations/action-button";
import { WhatsAppEmbeddedSignupButton } from "@/components/dashboard/whatsapp-embedded-signup-button";
import { disconnectWhatsApp, disconnectTwilio, syncWhatsAppTemplates } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  CONNECTED: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  ERROR: "bg-red-100 text-red-800",
  NOT_CONNECTED: "bg-foreground/10 text-foreground/50",
};

const TEMPLATE_STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  REJECTED: "bg-red-100 text-red-800",
  PAUSED: "bg-orange-100 text-orange-800",
  DISABLED: "bg-foreground/10 text-foreground/50",
  DRAFT: "bg-foreground/10 text-foreground/50",
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.NOT_CONNECTED}`}>{status}</span>;
}

export default async function IntegrationsPage() {
  const membership = await requireRole(["OWNER", "MANAGER"]);
  const supabase = await createClient();

  const { data: integrations } = await supabase
    .from("business_integrations")
    .select("*")
    .eq("business_id", membership.business_id)
    .in("provider", ["WHATSAPP", "SMS_TWILIO"]);

  const whatsapp = integrations?.find((i) => i.provider === "WHATSAPP");
  const twilio = integrations?.find((i) => i.provider === "SMS_TWILIO");
  const whatsappConfig = (whatsapp?.config ?? {}) as { phoneNumberId?: string; wabaId?: string; displayPhoneNumber?: string };
  const twilioConfig = (twilio?.config ?? {}) as { accountSid?: string; fromNumber?: string };

  const { data: templates } = whatsapp?.status === "CONNECTED"
    ? await supabase
        .from("message_templates")
        .select("*")
        .eq("business_id", membership.business_id)
        .eq("channel", "WHATSAPP")
        .order("last_synced_at", { ascending: false, nullsFirst: false })
    : { data: [] as never[] };

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-foreground/70">
          Connect WhatsApp, SMS, and email so campaigns and automations can send. Owner/manager only — never visible
          to staff.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">WhatsApp</h2>
          <StatusBadge status={whatsapp?.status ?? "NOT_CONNECTED"} />
        </div>

        {whatsapp?.status === "CONNECTED" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-4">
            <p className="text-sm text-foreground/70">
              Phone number ID <span className="font-mono">{whatsappConfig.phoneNumberId}</span>
              {whatsappConfig.displayPhoneNumber ? ` · ${whatsappConfig.displayPhoneNumber}` : ""}
            </p>
            <p className="text-sm text-foreground/70">
              WABA <span className="font-mono">{whatsappConfig.wabaId}</span>
            </p>
            <div className="flex gap-2">
              <ActionButton action={syncWhatsAppTemplates} label="Sync templates" pendingLabel="Syncing…" />
              <ActionButton action={disconnectWhatsApp} label="Disconnect" pendingLabel="Disconnecting…" variant="ghost" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <WhatsAppEmbeddedSignupButton appId={process.env.NEXT_PUBLIC_META_APP_ID} configId={process.env.NEXT_PUBLIC_META_CONFIG_ID} />
            <ConnectWhatsAppForm />
          </div>
        )}

        {whatsapp?.status === "CONNECTED" && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground/70">Templates</h3>
            {!templates?.length ? (
              <p className="text-sm text-foreground/50">No templates synced yet. Click &quot;Sync templates&quot; above.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-foreground/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-foreground/10 text-left text-xs uppercase tracking-wide text-foreground/50">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Language</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Last synced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id} className="border-b border-foreground/5 last:border-0">
                        <td className="px-3 py-2 font-medium">{t.name}</td>
                        <td className="px-3 py-2">{t.language}</td>
                        <td className="px-3 py-2">{t.category}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TEMPLATE_STATUS_STYLES[t.status] ?? TEMPLATE_STATUS_STYLES.DRAFT}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-foreground/60">
                          {t.last_synced_at ? new Date(t.last_synced_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">SMS (Twilio)</h2>
          <StatusBadge status={twilio?.status ?? "NOT_CONNECTED"} />
        </div>

        {twilio?.status === "CONNECTED" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-4">
            <p className="text-sm text-foreground/70">
              Account <span className="font-mono">{twilioConfig.accountSid}</span>
            </p>
            <p className="text-sm text-foreground/70">
              Sender <span className="font-mono">{twilioConfig.fromNumber}</span>
            </p>
            <ActionButton action={disconnectTwilio} label="Disconnect" pendingLabel="Disconnecting…" variant="ghost" />
          </div>
        ) : (
          <ConnectTwilioForm />
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-4">
        <h2 className="text-lg font-medium">Email</h2>
        <p className="text-sm text-foreground/70">
          Email is configured platform-wide (Resend) — no per-business connection needed. See docs/integrations.md
          for production domain-verification status.
        </p>
      </section>
    </div>
  );
}
