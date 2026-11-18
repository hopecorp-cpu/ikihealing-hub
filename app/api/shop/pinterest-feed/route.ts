import { NextResponse } from "next/server";
import { docCuaHang } from "@/lib/cua-hang";
import { dungFeed } from "@/lib/pinterest-feed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const f = dungFeed(await docCuaHang());
    return NextResponse.json(f, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
