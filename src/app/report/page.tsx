"use client";

import { useEffect, useState } from "react";
import { BuyerReferenceInput, FOLLOW_UP_OPTIONS, FollowUpStatus, PropertyOption } from "@/lib/types";
import Nav from "@/components/Nav";

function emptyBuyerRef(): BuyerReferenceInput {
  return { last4: "", feedback: "", followUpStatus: "Not Started" };
}

export default function ReportPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [propertyRecordId, setPropertyRecordId] = useState("");
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [submittedBy, setSubmittedBy] = useState("");
  const [groups, setGroups] = useState<number | "">("");
  const [potentialLeads, setPotentialLeads] = useState<number | "">("");
  const [buyerRefs, setBuyerRefs] = useState<BuyerReferenceInput[]>([]);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch("/api/properties")
      .then((res) => res.json())
      .then((data) => {
        if (data.properties) setProperties(data.properties);
      })
      .catch(() => {})
      .finally(() => setPropertiesLoading(false));
  }, []);

  function addBuyerRef() {
    setBuyerRefs((prev) => [...prev, emptyBuyerRef()]);
  }

  function removeBuyerRef(index: number) {
    setBuyerRefs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBuyerRef(index: number, patch: Partial<BuyerReferenceInput>) {
    setBuyerRefs((prev) => prev.map((ref, i) => (i === index ? { ...ref, ...patch } : ref)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          propertyRecordId,
          submittedBy,
          groups: Number(groups) || 0,
          potentialLeads: Number(potentialLeads) || 0,
          buyerReferences: buyerRefs,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submission failed");
      }

      setStatus("success");
      setDate(today);
      setGroups("");
      setPotentialLeads("");
      setBuyerRefs([]);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

if (status === "success") {
    return (
      <>
        <Nav />
        <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <h1 className="font-display text-3xl mb-3">Report submitted</h1>
          <p className="text-ink/60 mb-8">
            Your weekly report has been saved. The team dashboard updates in real time.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="rounded-lg bg-charcoal text-white px-5 py-2.5 text-sm font-medium hover:bg-charcoal/90 transition-colors"
          >
            Submit another report
          </button>
        </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="min-h-screen px-6 py-12">
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
        <p className="text-xs tracking-[0.2em] uppercase text-gold-dark mb-2">
          PropertyGiant
        </p>
        <h1 className="font-display text-3xl mb-8">Weekly Open House Report</h1>

        <div className="space-y-6 bg-white rounded-xl border border-charcoal/10 p-6 shadow-sm">
          <Field label="Property">
            <select
              required
              value={propertyRecordId}
              onChange={(e) => setPropertyRecordId(e.target.value)}
              className={inputClass}
              disabled={propertiesLoading}
            >
              <option value="" disabled>
                {propertiesLoading ? "Loading properties…" : "Select a property"}
              </option>
              {properties.map((p) => (
                <option key={p.recordId} value={p.recordId}>
                  {p.address}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Your Name">
              <input
                type="text"
                required
                placeholder="e.g. Jackie Chew"
                value={submittedBy}
                onChange={(e) => setSubmittedBy(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Groups">
              <input
                type="number"
                min={0}
                required
                value={groups}
                onChange={(e) => setGroups(e.target.value === "" ? "" : Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Potential Leads">
              <input
                type="number"
                min={0}
                required
                value={potentialLeads}
                onChange={(e) =>
                  setPotentialLeads(e.target.value === "" ? "" : Number(e.target.value))
                }
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium">Buyer Reference</label>
              <button
                type="button"
                onClick={addBuyerRef}
                className="text-sm font-medium text-gold-dark hover:text-charcoal transition-colors flex items-center gap-1"
              >
                <span className="text-lg leading-none">+</span> Add
              </button>
            </div>

            {buyerRefs.length === 0 && (
              <p className="text-sm text-ink/40 italic">No buyer references added yet.</p>
            )}

            <div className="space-y-4">
              {buyerRefs.map((ref, i) => (
                <div key={i} className="rounded-lg border border-charcoal/10 p-4 relative">
                  <button
                    type="button"
                    onClick={() => removeBuyerRef(i)}
                    aria-label="Remove buyer reference"
                    className="absolute top-3 right-3 text-ink/30 hover:text-red-600 text-sm"
                  >
                    ✕
                  </button>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Field label="Last 4 Digits">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="e.g. 2933"
                        required
                        value={ref.last4}
                        onChange={(e) => updateBuyerRef(i, { last4: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Follow-up Status">
                      <select
                        value={ref.followUpStatus}
                        onChange={(e) =>
                          updateBuyerRef(i, {
                            followUpStatus: e.target.value as FollowUpStatus,
                          })
                        }
                        className={inputClass}
                      >
                        {FOLLOW_UP_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Key Feedback">
                    <textarea
                      rows={2}
                      placeholder="What did the buyer say?"
                      value={ref.feedback}
                      onChange={(e) => updateBuyerRef(i, { feedback: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </div>

          {status === "error" && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-lg bg-charcoal text-white px-5 py-3 text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-50"
          >
            {status === "submitting" ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </main>
    </>
  );
}

const inputClass =
  "w-full rounded-md border border-charcoal/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink/60 mb-1">{label}</span>
      {children}
    </label>
  );
}
