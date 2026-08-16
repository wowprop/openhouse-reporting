import { NextResponse } from "next/server";
import { listRecords } from "@/lib/lark";
import { PropertyOption } from "@/lib/types";

const PROPERTIES_TABLE_ID = process.env.LARK_TABLE_PROPERTIES!;

export async function GET() {
  try {
    const { items } = await listRecords(PROPERTIES_TABLE_ID, { pageSize: 100 });
    const properties: PropertyOption[] = items.map((item) => ({
      recordId: item.record_id,
      address: String(item.fields["Address"] ?? "Untitled property"),
    }));
    return NextResponse.json({ ok: true, properties });
  } catch (err) {
    console.error("Failed to fetch properties:", err);
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}
