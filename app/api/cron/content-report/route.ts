import { NextResponse } from "next/server";
import { sendTelegram, sendTelegramMay, telegramConfigured } from "@/lib/telegram";
import { chanMay, khoaBaoCao, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const KHOA_ROUTE = [khoaCron({ bearer: true, query: ["secret"] }), khoaBaoCao({ headers: ["x-report-token"], query: ["token"] })];

export async function POST(req: Request) {
  const chanKhoa = await chanMay(req, KHOA_ROUTE); if (chanKhoa) return chanKhoa;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "body không phải JSON" }, { status: 400 }); }
  const report = String(body?.report || "").trim();
  if (!report) return NextResponse.json({ ok: false, error: "thiếu report" }, { status: 400 });
  let sent = false;
  try {
    if (telegramConfigured()) { await sendTelegramMay("noi-dung", "\u{1F4DD} BÁO CÁO VIẾT BÀI BLOG (Trợ lý AI)\n\n" + report); sent = true; }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sent });
}
