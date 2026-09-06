"use client";

import { useState } from "react";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export function WalletButtons({ token }: { token: string }) {
  const [platform] = useState<Platform>(() => detectPlatform());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<"apple" | "google" | null>(null);

  async function addToWallet(provider: "apple" | "google") {
    setPending(provider);
    setMessage(null);
    try {
      const res = await fetch(`/api/wallet/${provider}/${token}`);
      if (!res.ok) {
        setMessage(
          provider === "apple"
            ? "Apple Wallet isn't set up for this business yet — check back soon."
            : "Google Wallet isn't set up for this business yet — check back soon."
        );
        return;
      }
      // Once signing is implemented, this response is a .pkpass file or a
      // pay.google.com save link; not reachable until then.
    } finally {
      setPending(null);
    }
  }

  const buttons = [
    { provider: "apple" as const, label: "Add to Apple Wallet" },
    { provider: "google" as const, label: "Add to Google Wallet" },
  ];
  const ordered = platform === "android" ? [...buttons].reverse() : buttons;

  return (
    <div className="flex flex-col gap-2">
      {ordered.map((b) => (
        <button
          key={b.provider}
          onClick={() => addToWallet(b.provider)}
          disabled={pending !== null}
          className="rounded-full border border-current px-4 py-2 text-sm font-medium opacity-80 transition-opacity hover:opacity-100 disabled:opacity-50"
        >
          {pending === b.provider ? "Checking…" : b.label}
        </button>
      ))}
      {message && <p className="text-xs opacity-60">{message}</p>}
    </div>
  );
}
