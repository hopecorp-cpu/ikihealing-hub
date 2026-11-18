import { NextResponse } from "next/server";
import { sweepRecheck } from "@/lib/quiz-recheck";
import { covanSendCEO, covanTelegramConfigured } from "@/lib/covan/telegram";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  try {
    const r = await sweepRecheck();
    if (r.due > 0 && covanTelegramConfigured()) {
      await covanSendCEO(
        `VÒNG LẶP ĐO LẠI QUIZ\n${r.due} khách tới mốc đo lại hôm nay: đã gửi ${r.mailed} email mời làm lại bài kiểm tra nếp sống, giao việc nhắn Zalo cho ${r.tasked} khách.`
      );
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
