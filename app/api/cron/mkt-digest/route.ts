import { NextResponse } from "next/server";
import { mktDigest } from "@/lib/agent-report";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  try {
    const r = await mktDigest();
    if (!r.ok) return NextResponse.json(r, { status: 200 });
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
