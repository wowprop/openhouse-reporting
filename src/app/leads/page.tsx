"use client";

import { useEffect, useState } from "react";

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

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/leads")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setLeads(data.leads);
      })
      .catch(() => setError("Failed to load leads"));
  }, []);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <p className="text-xs tracking-[0.2em] uppercase text-gold-dark mb-2">
          PropertyGiant
        </p>
        <h1 className="font-display text-3xl mb-1">Walk-in Leads</h1>
        <p className="text-sm text-ink/50 mb-8">
          NRIC is not shown here — view it directly in Lark if needed.
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
  );
}

function formatCell(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
