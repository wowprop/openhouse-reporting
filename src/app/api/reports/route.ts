import { NextRequest, NextResponse } from "next/server";
import { createRecord, batchCreateRecords, updateRecord } from "@/lib/lark";
import { WeeklyReportInput, formatReportDate } from "@/lib/types";

const WEEKLY_REPORT_TABLE_ID = process.env.LARK_TABLE_WEEKLY_REPORT!;
const BUYER_REFS_TABLE_ID = process.env.LARK_TABLE_BUYER_REFERENCES!;
// Field name in Buyer References that links back to Weekly Report (per your table: "Weekly Report").
const LINK_FIELD_NAME = "Weekly Report";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WeeklyReportInput;

    if (!body.date || !body.submittedBy || !body.propertyRecordId) {
      return NextResponse.json(
        { error: "Date, Property, and Submitted By are required." },
        { status: 400 }
      );
    }

    // 1. Create the parent Weekly Report record, linked to the Property.
    const reportRecordId = await createRecord(WEEKLY_REPORT_TABLE_ID, {
      Date: new Date(`${body.date}T00:00:00`).getTime(),
      Property: [body.propertyRecordId],
      "Submitted By": body.submittedBy,
      Groups: body.groups,
      "Potential Leads": body.potentialLeads,
    });

    // 2. Create child Buyer Reference records, each linked to the parent report.
    let buyerRecordIds: string[] = [];
    if (body.buyerReferences?.length) {
      buyerRecordIds = await batchCreateRecords(
        BUYER_REFS_TABLE_ID,
        body.buyerReferences.map((ref) => ({
          "Last 4 Digits Mobile No.": ref.last4,
          "Key Feedback": ref.feedback,
          "Follow Up Status": ref.followUpStatus,
          [LINK_FIELD_NAME]: [reportRecordId],
        }))
      );
    }

    // 3. Fire-and-forget: generate an AI summary and write it back onto the report.
    generateAndSaveSummary(reportRecordId, body).catch((err) =>
      console.error("AI summary generation failed:", err)
    );

    return NextResponse.json({
      ok: true,
      reportRecordId,
      buyerRecordIds,
    });
  } catch (err) {
    console.error("Report submission failed:", err);
    return NextResponse.json(
      { error: "Failed to submit report. Please try again or notify admin." },
      { status: 500 }
    );
  }
}

async function generateAndSaveSummary(reportRecordId: string, body: WeeklyReportInput) {
  if (!process.env.ANTHROPIC_API_KEY) return;

  const prompt = `Summarize this open house report in 2-3 short sentences for a real estate team channel. Be concrete, mention any hot leads or urgent follow-ups.\n\nGroups: ${body.groups}\nPotential Leads: ${body.potentialLeads}\nBuyer notes:\n${body.buyerReferences.map((r) => `- (...${r.last4}) ${r.feedback} [${r.followUpStatus}]`).join("\n")}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const summary = data?.content?.find((b: { type: string }) => b.type === "text")?.text;
  if (summary) {
    await updateRecord(WEEKLY_REPORT_TABLE_ID, reportRecordId, { "AI Summary": summary });
  }
}
