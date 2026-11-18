import { NextResponse } from "next/server";
import { logEvent } from "@/lib/blog-nurture";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lid = u.searchParams.get("lid") || "";
  const e = (u.searchParams.get("e") || "").slice(0, 20);
  const m = u.searchParams.get("m") || undefined;
  if (lid && ["read", "click", "download", "open"].includes(e)) {
    try { await logEvent(lid, e, m); } catch {  }
  }
  return new NextResponse(GIF, { status: 200, headers: { "Content-Type": "image/gif", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
