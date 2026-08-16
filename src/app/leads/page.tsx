"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";

interface LeadRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

// Which Lark fields to show, and in what order.
// NOTE: NRIC is intentionally NOT shown in this general table view — it's sensitive
// under PDPA and should only be visible to whoever handles compliance docs. View it
// directly in Lark (with Advanced Permission field restrictions applied) if needed.
const COLUMNS = [
  "Name",
  "Contact",
  "Property",
  "Served By",
  "Got Agent?",
  "What Brings You Here?",
  "Timeline",
  "Need to Sell First?",
  "Specific Requirements",
];

const POLL_INTERVAL_MS = 15000;

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[] | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstLoad = useRef(true);

  const fetchLeads = useCallback(async () => {
    if (!isFirstLoad.current) setRefreshing(true);
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setLeads(data.leads);
        setError("");
        setLastUpdated(new Date());
      }
    } catch {
      setError("Failed to load leads");
    } finally {
      isFirstLoad.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, POLL_INTERVAL_MS);

    const onFocus = () => fetchLeads();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchLeads]);

  return (
    <>
    <Nav />
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <p className="text-xs tracking-[0.2em] uppercase text-gold-dark mb-2">
          PropertyGiant
        </p>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h1 className="font-display text-3xl">Walk-in Leads</h1>
          <button
            onClick={fetchLeads}
            disabled={refreshing}
            className="text-sm font-medium text-gold-dark hover:text-charcoal transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className={refreshing ? "animate-spin inline-block" : "inline-block"}>
              ↻
            </span>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p className="text-sm text-ink/50 mb-8">
          NRIC is not shown here — view it directly in Lark if needed.
          {lastUpdated && (
            <> · Updated {lastUpdated.toLocaleTimeString("en-SG")}</>
          )}
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!leads && !error && <p className="text-sm text-ink/50">Loading…</p>}

        {leads && leads.length === 0 && (
          <p className="text-sm text-ink/50">No leads yet.</p>
        )}

        {leads && leads.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 text-left">
                  {COLUMNS.map((col) => (
                    <th key={col} className="px-4 py-3 font-medium text-ink/60 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.record_id} className="border-b border-charcoal/5 last:border-0">
                    {COLUMNS.map((col) => (
                      <td key={col} className="px-4 py-3 whitespace-nowrap">
                        {formatCell(lead.fields[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
    </>
  );
}

function formatCell(value: unknown): string {
  if (value === undefined || value === null) return "—";

  // Lark Link fields return an array of objects like
  // { record_ids, table_id, text, text_arr, type } — pull out the readable text.
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (
      typeof value[0] === "object" &&
      value[0] !== null &&
      "text" in (value[0] as Record<string, unknown>)
    ) {
      return (
        value
          .map((v) => (v as { text?: string }).text)
          .filter(Boolean)
          .join(", ") || "—"
      );
    }
    return value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
  }

  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}