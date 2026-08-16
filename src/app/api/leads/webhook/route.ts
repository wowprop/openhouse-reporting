import { NextRequest, NextResponse } from "next/server";
import { createRecord } from "@/lib/lark";
import crypto from "crypto";

const LEADS_TABLE_ID = process.env.LARK_TABLE_WALKIN_LEADS!;
const WEBFLOW_WEBHOOK_SECRET = process.env.WEBFLOW_WEBHOOK_SECRET;

/**
 * Receives Webflow's "Form Submission" webhook payload and writes into Walk-in Leads.
 *
 * IMPORTANT — ACTION NEEDED: "Property" and "Served By" are Link fields in your Base,
 * pointing at the Properties and Agents tables. A raw Webflow text submission (e.g.
 * "53 Jalan Ketumbit") is NOT a linked record — Lark won't auto-match text to an
 * existing Property row, and this route intentionally does NOT attempt to write to
 * the "Property" or "Served By" link fields (writing a plain string there would fail,
 * since link fields expect an array of record IDs).
 *
 * Instead, the raw address text is prefixed onto "Specific Requirements" so it isn't
 * lost, and it's your team's job to manually link each new lead to the correct
 * Property/Agent record in the Lark UI after it comes in.
 *
 * A cleaner long-term fix: before creating the record, look up the Properties table
 * for a matching address (via listRecords + string match) and pass its record_id into
 * the "Property" field as a link. That's a good next iteration once you have a stable
 * set of property records to match against — ask if you'd like this built.
 */

const WEBFLOW_FIELD_MAP: Record<string, string> = {
  Name: "Name",
  Contact: "Contact",
  "Got-Agent": "Got Agent?",
  "What-Brings-You-Here": "What Brings You Here?",
  Timeline: "Timeline",
  "Need-To-Sell-First": "Need to Sell First?",
  NRIC: "NRIC",
};

function verifySignature(req: NextRequest, rawBody: string): boolean {
  if (!WEBFLOW_WEBHOOK_SECRET) return true;
  const signature = req.headers.get("x-webflow-signature");
  const timestamp = req.headers.get("x-webflow-timestamp");
  if (!signature || !timestamp) return false;

  const expected = crypto
    .createHmac("sha256", WEBFLOW_WEBHOOK_SECRET)
    .update(`${timestamp}:${rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySignature(req, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const formData: Record<string, string> = payload?.payload?.data ?? payload?.data ?? payload;

  const fields: Record<string, unknown> = {};

  for (const [webflowKey, larkField] of Object.entries(WEBFLOW_FIELD_MAP)) {
    if (formData?.[webflowKey] !== undefined) {
      fields[larkField] = formData[webflowKey];
    }
  }

  // Raw address text can't be written to the "Property" link field directly (see note
  // above) — fold it into Specific Requirements instead so it's visible and searchable.
  const rawAddress = formData?.["Field"];
  const specificRequirements = formData?.["Specific-Requirements"];
  const requirementsParts = [
    rawAddress ? `Property (unlinked): ${rawAddress}` : null,
    specificRequirements || null,
  ].filter(Boolean);
  if (requirementsParts.length) {
    fields["Specific Requirements"] = requirementsParts.join(" — ");
  }

  try {
    const recordId = await createRecord(LEADS_TABLE_ID, fields);
    return NextResponse.json({ ok: true, recordId });
  } catch (err) {
    console.error("Lead capture failed:", err);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}
