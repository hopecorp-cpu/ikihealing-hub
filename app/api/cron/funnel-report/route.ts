import { NextResponse } from "next/server";
import { buildFunnelReport } from "@/lib/funnel";
import { sendTelegram, sendTelegramMay, telegramConfigured } from "@/lib/telegram";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron({ bearer: true, query: ["secret"] })]);
  if (chanKhoa) return chanKhoa;
  let sent = false;
  try {
    const text = await buildFunnelReport(7);
    if (telegramConfigured()) { await sendTelegramMay("noi-dung", text); sent = true; }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sent });
}
