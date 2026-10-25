import { NextResponse } from "next/server";
import { listAllRecords } from "@/lib/lark";
import { filterActive } from "@/lib/active";
import { PropertyOption } from "@/lib/types";

// Without this Next may prerender this route at build time, freezing the property
// dropdown at whatever Lark held during the build.
export const dynamic = "force-dynamic";

const PROPERTIES_TABLE_ID = process.env.LARK_TABLE_PROPERTIES!;

export async function GET() {
  try {
    // Only Properties with the Lark "Active" checkbox ticked are offered on /check-in
    // and /report. Existing records are untouched — this filters the picker only.
    const items = await listAllRecords(PROPERTIES_TABLE_ID);
    const active = await filterActive(PROPERTIES_TABLE_ID, items);
    const properties: PropertyOption[] = active.map((item) => ({
      recordId: item.record_id,
      address: String(item.fields["Address"] ?? "Untitled property"),
    }));
    return NextResponse.json(
      { ok: true, properties },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Failed to fetch properties:", err);
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}
