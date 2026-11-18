import { NextResponse } from "next/server";
import { runAutopilot, sendAdsReport } from "@/lib/ads-autopilot";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const dry = url.searchParams.get("dry") === "1";
  const r = await runAutopilot({ forceDry: dry });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 200 });

  if (r.text && !dry) {

    await sendAdsReport(r.text);
  }
  return NextResponse.json({ ok: true, enabled: r.enabled, executed: r.executed, planned: r.planned, dry, text: r.text }, { status: 200 });
}

export const GET = handle;
export const POST = handle;
