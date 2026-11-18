import { NextResponse } from "next/server";
import { buildAdsReport, saveAdsDays, normalizeDay } from "@/lib/google-ads";
import { telegramConfigured } from "@/lib/telegram";
import { sendAdsReport } from "@/lib/ads-autopilot";
import { chanMay, khoaBaoCao, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KHOA_ROUTE = [khoaCron({ bearer: true, query: ["secret"] }), khoaBaoCao({ headers: ["x-ads-token"], query: ["token"] })];

export async function POST(req: Request) {
  const chanKhoa = await chanMay(req, KHOA_ROUTE); if (chanKhoa) return chanKhoa;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "body không phải JSON" }, { status: 400 }); }

  const loNgay: Array<{ date?: string; campaigns: any[] }> = Array.isArray(body?.days)
    ? body.days.filter((d: any) => Array.isArray(d?.campaigns))
    : Array.isArray(body?.campaigns)
      ? [{ date: body.date, campaigns: body.campaigns }]
      : [];
  if (!loNgay.length) {
    return NextResponse.json({ ok: false, error: "thiếu mảng campaigns (hoặc days[])" }, { status: 400 });
  }
  try {
    const days = loNgay.map((d) => normalizeDay(d)).sort((a, b) => (a.date < b.date ? -1 : 1));
    await saveAdsDays(days);

    const day = days[days.length - 1];
    const report = await buildAdsReport(day);
    let sent = false;
    if (body.dry !== true && telegramConfigured()) { await sendAdsReport(report); sent = true; }
    return NextResponse.json({ ok: true, saved: days.map((d) => d.date), sent, report });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, KHOA_ROUTE); if (chanKhoa) return chanKhoa;
  const url = new URL(req.url);
  try {
    const report = await buildAdsReport(null);
    let sent = false;
    if (url.searchParams.get("send") === "1" && telegramConfigured()) { await sendAdsReport(report); sent = true; }
    return NextResponse.json({ ok: true, sent, report });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
