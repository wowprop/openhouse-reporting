import { NextResponse } from "next/server";
import { listRecords } from "@/lib/lark";

const LEADS_TABLE_ID = process.env.LARK_TABLE_WALKIN_LEADS!;

export async function GET() {
  try {
    const { items } = await listRecords(LEADS_TABLE_ID, { pageSize: 100 });
    return NextResponse.json({ ok: true, leads: items });
  } catch (err) {
    console.error("Failed to fetch leads:", err);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
