import { NextRequest, NextResponse } from "next/server";
import { createRecord } from "@/lib/lark";
import { CheckInInput } from "@/lib/types";

const LEADS_TABLE_ID = process.env.LARK_TABLE_WALKIN_LEADS!;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CheckInInput;

    if (
      !body.name ||
      !body.contact ||
      !body.propertyRecordId ||
      !body.agentRecordId ||
      !body.gotAgent ||
      !body.whatBrings ||
      !body.timeline ||
      !body.needToSellFirst
    ) {
      return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
    }

    const fields: Record<string, unknown> = {
      Name: body.name,
      Contact: body.contact,
      Property: [body.propertyRecordId],
      "Served By": [body.agentRecordId],
      "Got Agent?": body.gotAgent,
      "What Brings You Here?": body.whatBrings,
      Timeline: body.timeline,
      "Need to Sell First?": body.needToSellFirst,
    };

    if (body.specificRequirements) fields["Specific Requirements"] = body.specificRequirements;
    if (body.nric) fields["NRIC"] = body.nric;

    const recordId = await createRecord(LEADS_TABLE_ID, fields);
    return NextResponse.json({ ok: true, recordId });
  } catch (err) {
    console.error("Check-in submission failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please notify staff at the entrance." },
      { status: 500 }
    );
  }
}
