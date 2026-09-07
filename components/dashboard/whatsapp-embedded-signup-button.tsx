"use client";

import { useEffect, useState } from "react";
import { completeWhatsAppEmbeddedSignup } from "@/app/dashboard/integrations/actions";

declare global {
  interface Window {
    FB?: {
      init: (config: { appId: string; version: string; xfbml?: boolean }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

/**
 * Meta WhatsApp Embedded Signup (spec item 6: "Integrations → WhatsApp →
 * Connect WhatsApp"). This is Meta's real client-side flow — `FB.login`
 * with a Embedded Signup `config_id`, plus a `message` listener for the
 * `WA_EMBEDDED_SIGNUP` event Meta's JS SDK posts back with the `waba_id`/
 * `phone_number_id` the business owner selected — not a guessed
 * approximation. The resulting authorization `code` is exchanged for a
 * token server-side only (app/dashboard/integrations/actions.ts) — the
 * browser never holds the access token.
 *
 * Disabled (falls back to the manual connect form) unless
 * NEXT_PUBLIC_META_APP_ID and NEXT_PUBLIC_META_CONFIG_ID are set — neither
 * exists in this environment (no Meta app to register them against), so
 * this button has not been exercised against a real Meta Embedded Signup
 * flow. See docs/integrations.md — CODE PATH READY / EXTERNAL META APPROVAL
 * REQUIRED.
 */
export function WhatsAppEmbeddedSignupButton({ appId, configId }: { appId?: string; configId?: string }) {
  const [status, setStatus] = useState<"idle" | "connecting" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  const configured = Boolean(appId && configId);

  useEffect(() => {
    if (!configured) return;

    window.fbAsyncInit = () => {
      window.FB?.init({ appId: appId!, version: process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION || "v23.0", xfbml: true });
      setSdkReady(true);
    };

    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    let signupData: { wabaId?: string; phoneNumberId?: string } = {};

    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.event === "FINISH") {
          signupData = {
            wabaId: data?.data?.waba_id,
            phoneNumberId: data?.data?.phone_number_id,
          };
        }
      } catch {
        // Not a JSON message we care about — ignore.
      }
    }
    window.addEventListener("message", handleMessage);

    (window as unknown as { __waSignupData: typeof signupData }).__waSignupData = signupData;
    return () => window.removeEventListener("message", handleMessage);
  }, [configured, appId, configId]);

  function handleClick() {
    if (!window.FB) return;
    setStatus("connecting");
    setError(null);

    window.FB.login(
      async (response) => {
        const code = response.authResponse?.code;
        const signupData = (window as unknown as { __waSignupData?: { wabaId?: string; phoneNumberId?: string } }).__waSignupData;

        if (!code || !signupData?.wabaId || !signupData?.phoneNumberId) {
          setStatus("error");
          setError("The connection was cancelled or Meta didn't return the expected details.");
          return;
        }

        const result = await completeWhatsAppEmbeddedSignup({
          code,
          wabaId: signupData.wabaId,
          phoneNumberId: signupData.phoneNumberId,
        });

        if (result?.error) {
          setStatus("error");
          setError(result.error);
        } else {
          setStatus("success");
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      }
    );
  }

  if (!configured) {
    return (
      <div className="rounded-md border border-dashed border-foreground/20 p-4 text-sm text-foreground/60">
        <p className="font-medium text-foreground/80">Connect WhatsApp (Embedded Signup)</p>
        <p className="mt-1">
          CODE PATH READY — EXTERNAL META APPROVAL REQUIRED. Set <code>NEXT_PUBLIC_META_APP_ID</code> and{" "}
          <code>NEXT_PUBLIC_META_CONFIG_ID</code> once a Meta Business/Developer app with WhatsApp Embedded Signup
          exists. Use the manual connection below until then.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={!sdkReady || status === "connecting"}
        className="w-fit rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {status === "connecting" ? "Connecting…" : "Connect WhatsApp"}
      </button>
      {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}
      {status === "success" && <p className="text-sm text-green-700">Connected.</p>}
    </div>
  );
}
