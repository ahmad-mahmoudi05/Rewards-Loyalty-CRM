"use client";

import { useCallback, useEffect, useState } from "react";
import { QrScanner } from "@/components/dashboard/qr-scanner";
import { CustomerOperationalPanel } from "@/components/dashboard/customer-operational-panel";
import {
  resolveCustomerByToken,
  searchCustomers,
  getOperationalView,
  type OperationalView,
  type SearchResult,
} from "./actions";

type Mode = "home" | "scan" | "search" | "result";

/**
 * USB/Bluetooth barcode scanners behave like a keyboard: they type the
 * scanned payload into whatever's focused, then send Enter. This input
 * captures that without any special driver — the same wallet_token that
 * the camera path decodes from a QR image works here unchanged, per the
 * hardware-scanner compatibility documented in docs/architecture.md.
 */
function HardwareScannerInput({ onScan }: { onScan: (text: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) {
          e.preventDefault();
          onScan(value.trim());
          setValue("");
        }
      }}
      placeholder="Or scan/paste a code here"
      className="rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
    />
  );
}

type Location = { id: string; name: string; is_primary: boolean };

export function StaffModeClient({
  businessId,
  locations,
  currency,
  staffLabel,
  recentTransactions,
}: {
  businessId: string;
  locations: Location[];
  currency: string;
  staffLabel: string;
  recentTransactions: { id: string; customerName: string; total: string; createdAt: string }[];
}) {
  const [mode, setMode] = useState<Mode>("home");
  const [view, setView] = useState<OperationalView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string>(
    locations.find((l) => l.is_primary)?.id ?? locations[0]?.id ?? ""
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(`loyalnest_active_location_${businessId}`);
    if (stored && locations.some((l) => l.id === stored)) {
      // Deliberate exception: this patches in browser-only state
      // (localStorage isn't available during SSR) after mount, which is
      // exactly the pattern that avoids a hydration mismatch here — the
      // initial useState above already renders a valid default.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveLocationId(stored);
    }
  }, [businessId, locations]);

  function changeLocation(id: string) {
    setActiveLocationId(id);
    window.localStorage.setItem(`loyalnest_active_location_${businessId}`, id);
  }

  const handleScan = useCallback(async (rawText: string) => {
    setError(null);
    const result = await resolveCustomerByToken(rawText);
    if ("error" in result) {
      setError(result.error);
      setMode("home");
      return;
    }
    setView(result.view);
    setMode("result");
  }, []);

  async function refreshView() {
    if (!view) return;
    const result = await getOperationalView(view.customer.id!);
    if ("view" in result) setView(result.view);
  }

  async function runSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchResults(await searchCustomers(q));
  }

  async function pickSearchResult(id: string) {
    const result = await getOperationalView(id);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setView(result.view);
    setMode("result");
  }

  if (mode === "result" && view) {
    return (
      <CustomerOperationalPanel
        view={view}
        locationId={activeLocationId || null}
        currency={currency}
        onRefresh={refreshView}
        onDone={() => {
          setView(null);
          setMode("home");
        }}
      />
    );
  }

  if (mode === "scan") {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setMode("home")} className="w-fit text-sm text-foreground/60 hover:text-foreground">
          ← Back
        </button>
        <p className="text-center text-sm text-foreground/70">Point the camera at the customer&apos;s loyalty card.</p>
        <QrScanner onScan={handleScan} />
        <HardwareScannerInput onScan={handleScan} />
      </div>
    );
  }

  if (mode === "search") {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setMode("home")} className="w-fit text-sm text-foreground/60 hover:text-foreground">
          ← Back
        </button>
        <input
          autoFocus
          type="search"
          value={searchQuery}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Phone, name, or email"
          className="rounded-lg border border-foreground/15 bg-transparent px-4 py-3 text-base outline-none focus:border-foreground/40"
        />
        <div className="flex flex-col divide-y divide-foreground/10 rounded-lg border border-foreground/10">
          {searchResults.map((r) => (
            <button
              key={r.id}
              onClick={() => pickSearchResult(r.id)}
              className="flex items-center justify-between px-4 py-3 text-left hover:bg-foreground/5"
            >
              <span className="font-medium">{r.label}</span>
              <span className="text-sm text-foreground/60">{r.phone}</span>
            </button>
          ))}
          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="px-4 py-3 text-sm text-foreground/60">No matches.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">LoyalNest Staff</h1>
          <p className="text-sm text-foreground/60">{staffLabel}</p>
        </div>
        {locations.length > 1 ? (
          <select
            value={activeLocationId}
            onChange={(e) => changeLocation(e.target.value)}
            className="rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        ) : (
          locations[0] && <span className="text-sm text-foreground/60">{locations[0].name}</span>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => {
            setError(null);
            setMode("scan");
          }}
          className="rounded-2xl bg-foreground px-8 py-10 text-xl font-semibold text-background transition-opacity hover:opacity-90"
        >
          📷 Scan Customer
        </button>
        <button
          onClick={() => {
            setError(null);
            setSearchQuery("");
            setSearchResults([]);
            setMode("search");
          }}
          className="rounded-2xl border border-foreground/15 px-8 py-10 text-xl font-semibold transition-colors hover:bg-foreground/5"
        >
          🔍 Search Customer
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Recent transactions</h2>
        {recentTransactions.length ? (
          <div className="flex flex-col divide-y divide-foreground/10 rounded-lg border border-foreground/10">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium">{t.customerName}</span>
                <span className="text-foreground/60">
                  {currency} {t.total}
                </span>
                <span className="text-xs text-foreground/50">{t.createdAt}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground/60">No transactions recorded yet.</p>
        )}
      </div>
    </div>
  );
}
