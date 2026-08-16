"use client";

import { useEffect, useState } from "react";
import {
  AgentOption,
  CheckInInput,
  GOT_AGENT_OPTIONS,
  NEED_TO_SELL_OPTIONS,
  PropertyOption,
  TIMELINE_OPTIONS,
  WHAT_BRINGS_OPTIONS,
} from "@/lib/types";

const emptyForm: CheckInInput = {
  name: "",
  contact: "",
  propertyRecordId: "",
  agentRecordId: "",
  gotAgent: "" as CheckInInput["gotAgent"],
  whatBrings: "" as CheckInInput["whatBrings"],
  timeline: "" as CheckInInput["timeline"],
  needToSellFirst: "" as CheckInInput["needToSellFirst"],
  specificRequirements: "",
  nric: "",
};

export default function CheckInPage() {
  const [form, setForm] = useState<CheckInInput>(emptyForm);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/properties").then((res) => res.json()),
      fetch("/api/agents").then((res) => res.json()),
    ])
      .then(([propData, agentData]) => {
        if (propData.properties) setProperties(propData.properties);
        if (agentData.agents) setAgents(agentData.agents);
      })
      .catch(() => {})
      .finally(() => setOptionsLoading(false));
  }, []);

  function update<K extends keyof CheckInInput>(key: K, value: CheckInInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submission failed");
      }

      setStatus("success");
      setForm(emptyForm);
      setConsent(false);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <h1 className="font-display text-3xl mb-3">You&apos;re checked in</h1>
          <p className="text-ink/60 mb-8">
            Thanks for registering — enjoy the viewing! An agent will be with you shortly.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="rounded-lg bg-charcoal text-white px-5 py-2.5 text-sm font-medium hover:bg-charcoal/90 transition-colors"
          >
            Register another visitor
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
        <p className="text-xs tracking-[0.2em] uppercase text-gold-dark mb-2">PropertyGiant</p>
        <h1 className="font-display text-3xl mb-2">Open House Registration</h1>
        <p className="text-sm text-ink/60 mb-8">
          Welcome! Please take a moment to register before viewing the property.
        </p>

        <div className="space-y-6 bg-white rounded-xl border border-charcoal/10 p-6 shadow-sm">
          <Field label="Name">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Mobile No.">
            <input
              type="tel"
              required
              value={form.contact}
              onChange={(e) => update("contact", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Viewing Property">
            <select
              required
              value={form.propertyRecordId}
              onChange={(e) => update("propertyRecordId", e.target.value)}
              className={inputClass}
              disabled={optionsLoading}
            >
              <option value="" disabled>
                {optionsLoading ? "Loading…" : "Select a property"}
              </option>
              {properties.map((p) => (
                <option key={p.recordId} value={p.recordId}>
                  {p.address}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Served by Agent">
            <select
              required
              value={form.agentRecordId}
              onChange={(e) => update("agentRecordId", e.target.value)}
              className={inputClass}
              disabled={optionsLoading}
            >
              <option value="" disabled>
                {optionsLoading ? "Loading…" : "Select an agent"}
              </option>
              {agents.map((a) => (
                <option key={a.recordId} value={a.recordId}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          <RadioGroup
            label="Are you currently represented by an agent?"
            options={GOT_AGENT_OPTIONS}
            value={form.gotAgent}
            onChange={(v) => update("gotAgent", v)}
          />

          <RadioGroup
            label="What brings you here today?"
            options={WHAT_BRINGS_OPTIONS}
            value={form.whatBrings}
            onChange={(v) => update("whatBrings", v)}
          />

          <RadioGroup
            label="What is your purchase timeline?"
            options={TIMELINE_OPTIONS}
            value={form.timeline}
            onChange={(v) => update("timeline", v)}
          />

          <RadioGroup
            label="Do you need to sell your current property before your next purchase?"
            options={NEED_TO_SELL_OPTIONS}
            value={form.needToSellFirst}
            onChange={(v) => update("needToSellFirst", v)}
          />

          <Field label="Anything specific you're looking for? (Optional)">
            <textarea
              rows={2}
              value={form.specificRequirements}
              onChange={(e) => update("specificRequirements", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="NRIC (Last 4 digits)">
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={form.nric}
              onChange={(e) => update("nric", e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="border-t border-charcoal/10 pt-5">
            <p className="text-xs font-medium text-ink/60 mb-2">Disclaimer &amp; Consent</p>
            <p className="text-xs text-ink/50 mb-3">
              By submitting this form I consent to PropertyGiant and the attending salesperson
              contacting me regarding this property and other relevant property opportunities. My
              personal information will be handled in accordance with applicable data protection
              requirements.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              I agree to the above terms and conditions.
            </label>
          </div>

          {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}

          <button
            type="submit"
            disabled={status === "submitting" || !consent}
            className="w-full rounded-lg bg-charcoal text-white px-5 py-3 text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-50"
          >
            {status === "submitting" ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </main>
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

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-ink/60 mb-2">{label}</span>
      <div className="space-y-1.5">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name={label}
              required
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}
