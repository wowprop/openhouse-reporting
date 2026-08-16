import { NextResponse } from "next/server";
import { listRecords } from "@/lib/lark";
import { AgentOption } from "@/lib/types";

const AGENTS_TABLE_ID = process.env.LARK_TABLE_AGENTS!;

export async function GET() {
  try {
    const { items } = await listRecords(AGENTS_TABLE_ID, { pageSize: 100 });
    const agents: AgentOption[] = items.map((item) => ({
      recordId: item.record_id,
      name: String(item.fields["Name"] ?? "Unnamed agent"),
    }));
    return NextResponse.json({ ok: true, agents });
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
