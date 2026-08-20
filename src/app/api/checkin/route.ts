import { NextRequest, NextResponse } from "next/server";
import { createRecord, listRecords } from "@/lib/lark";
import { notifyCheckIn } from "@/lib/telegram";
import { CheckInInput } from "@/lib/types";

const LEADS_TABLE_ID = process.env.LARK_TABLE_WALKIN_LEADS!;
const PROPERTIES_TABLE_ID = process.env.LARK_TABLE_PROPERTIES!;
const AGENTS_TABLE_ID = process.env.LARK_TABLE_AGENTS!;

/**
 * The form submits Lark record IDs, which are meaningless in a notification, so resolve
 * them back to display names. Falls back to a placeholder rather than failing — a
 * notification with a missing label still beats no notification.
 */
async function resolveLabels(propertyRecordId: string, agentRecordId: string) {
  const [properties, agents] = await Promise.all([
    listRecords(PROPERTIES_TABLE_ID, { pageSize: 100 }),
    listRecords(AGENTS_TABLE_ID, { pageSize: 100 }),
  ]);

  const property = properties.items.find((i) => i.record_id === propertyRecordId);
  const agent = agents.items.find((i) => i.record_id === agentRecordId);

  return {
    property: String(property?.fields["Address"] ?? "Unknown property"),
    agent: String(agent?.fields["Name"] ?? "Unknown agent"),
  };
}

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

    // The registration is already saved at this point. Notification problems must not
    // turn a successful check-in into an error for the visitor, so failures here are
    // logged and swallowed rather than propagated.
    try {
      const { property, agent } = await resolveLabels(body.propertyRecordId, body.agentRecordId);
      await notifyCheckIn({
        name: body.name,
        contact: body.contact,
        property,
        agent,
        gotAgent: body.gotAgent,
        whatBrings: body.whatBrings,
        timeline: body.timeline,
        needToSellFirst: body.needToSellFirst,
        specificRequirements: body.specificRequirements,
      });
    } catch (notifyErr) {
      console.error("Telegram notification failed (registration was saved):", notifyErr);
    }

    return NextResponse.json({ ok: true, recordId });
  } catch (err) {
    console.error("Check-in submission failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please notify staff at the entrance." },
      { status: 500 }
    );
  }
}
