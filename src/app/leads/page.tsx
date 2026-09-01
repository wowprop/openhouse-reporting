"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";

interface LeadRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

// NOTE: NRIC is intentionally absent from both the summary row and the expanded panel —
// it's sensitive under PDPA and should only be visible to whoever handles compliance
// docs. View it directly in Lark (with Advanced Permission field restrictions) if needed.

/** Shown in the collapsed row. Keep this short so the table stays readable on a laptop. */
const SUMMARY_COLUMNS = ["Date Created", "Name", "Contact", "Property", "Served By"];

/** Revealed when a row is expanded. */
const DETAIL_COLUMNS = [
  "Date & Time",
  "Got Agent?",
  "What Brings You Here?",
  "Timeline",
  "Need to Sell First?",
];

/** Free text, often several sentences — gets its own full-width block rather than a cell. */
const LONG_TEXT_COLUMN = "Specific Requirements";

const DATE_COLUMNS = new Set(["Date Created", "Date & Time"]);

const POLL_INTERVAL_MS = 15000;

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[] | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  // Keyed by record_id, so expanded rows survive the 15s poll replacing the array.
  function toggle(recordId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  // Newest first — the whole point of this page is seeing who just walked in.
  const sorted = leads
    ? [...leads].sort((a, b) => toTime(b.fields["Date Created"]) - toTime(a.fields["Date Created"]))
    : null;

  return (
    <>
      <Nav />
      <main className="min-h-screen px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs tracking-[0.2em] uppercase text-gold-dark mb-2">PropertyGiant</p>
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h1 className="font-display text-3xl">Walk-in Leads</h1>
            <button
              onClick={fetchLeads}
              disabled={refreshing}
              className="text-sm font-medium text-gold-dark hover:text-charcoal transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className={refreshing ? "animate-spin inline-block" : "inline-block"}>↻</span>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <p className="text-sm text-ink/50 mb-8">
            Select a row for full details. NRIC is not shown here — view it directly in Lark
            if needed.
            {lastUpdated && <> · Updated {lastUpdated.toLocaleTimeString("en-SG")}</>}
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {!sorted && !error && <p className="text-sm text-ink/50">Loading…</p>}

          {sorted && sorted.length === 0 && <p className="text-sm text-ink/50">No leads yet.</p>}

          {sorted && sorted.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-charcoal/10 text-left">
                    <th className="w-10 px-2 py-3">
                      <span className="sr-only">Expand</span>
                    </th>
                    {SUMMARY_COLUMNS.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 font-medium text-ink/60 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((lead) => {
                    const isOpen = expanded.has(lead.record_id);
                    const requirements = formatCell(lead.fields[LONG_TEXT_COLUMN]);

                    return (
                      <Fragment key={lead.record_id}>
                        <tr
                          onClick={() => toggle(lead.record_id)}
                          className={`border-b border-charcoal/5 cursor-pointer transition-colors ${
                            isOpen ? "bg-charcoal/[0.03]" : "hover:bg-charcoal/[0.02]"
                          }`}
                        >
                          <td className="px-2 py-3 align-top">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(lead.record_id);
                              }}
                              aria-expanded={isOpen}
                              aria-label={`${isOpen ? "Collapse" : "Expand"} details for ${formatCell(
                                lead.fields["Name"]
                              )}`}
                              className="w-6 h-6 flex items-center justify-center rounded text-ink/40 hover:text-charcoal hover:bg-charcoal/5 transition-colors"
                            >
                              <span
                                className={`inline-block transition-transform ${
                                  isOpen ? "rotate-90" : ""
                                }`}
                              >
                                ›
                              </span>
                            </button>
                          </td>
                          {SUMMARY_COLUMNS.map((col) => (
                            <td key={col} className="px-4 py-3 whitespace-nowrap">
                              {DATE_COLUMNS.has(col)
                                ? formatDate(lead.fields[col])
                                : formatCell(lead.fields[col])}
                            </td>
                          ))}
                        </tr>

                        {isOpen && (
                          <tr className="border-b border-charcoal/5 bg-charcoal/[0.03]">
                            <td colSpan={SUMMARY_COLUMNS.length + 1} className="px-6 py-5">
                              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                                {DETAIL_COLUMNS.map((col) => (
                                  <div key={col}>
                                    <dt className="text-xs font-medium text-ink/50 mb-1">{col}</dt>
                                    <dd>
                                      {DATE_COLUMNS.has(col)
                                        ? formatDate(lead.fields[col])
                                        : formatCell(lead.fields[col])}
                                    </dd>
                                  </div>
                                ))}
                              </dl>

                              <div className="mt-5 pt-4 border-t border-charcoal/10">
                                <dt className="text-xs font-medium text-ink/50 mb-1">
                                  {LONG_TEXT_COLUMN}
                                </dt>
                                {/* pre-wrap keeps the visitor's own line breaks; break-words
                                    stops a long unbroken string widening the whole table. */}
                                <dd className="whitespace-pre-wrap break-words leading-relaxed max-w-3xl">
                                  {requirements}
                                </dd>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

/** Lark date fields come back as epoch milliseconds. */
function toTime(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function formatDate(value: unknown): string {
  const ms = toTime(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCell(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";

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
