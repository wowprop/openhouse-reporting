import { NextResponse } from "next/server";
import { listAllRecords } from "@/lib/lark";
import { filterActive } from "@/lib/active";
import { AgentOption } from "@/lib/types";

// Without this Next may prerender this route at build time, freezing the agent
// dropdown at whatever Lark held during the build.
export const dynamic = "force-dynamic";

const AGENTS_TABLE_ID = process.env.LARK_TABLE_AGENTS!;

export async function GET() {
  try {
    // Only Agents with the Lark "Active" checkbox ticked are offered on /check-in.
    // Inactive agents stay linked to their historical leads, but cannot be picked.
    const items = await listAllRecords(AGENTS_TABLE_ID);
    const active = await filterActive(AGENTS_TABLE_ID, items);
    const agents: AgentOption[] = active.map((item) => ({
      recordId: item.record_id,
      name: String(item.fields["Name"] ?? "Unnamed agent"),
    }));
    return NextResponse.json(
      { ok: true, agents },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
