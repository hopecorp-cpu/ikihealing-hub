import { NextResponse } from "next/server";
import { ttsConfigured } from "@/lib/tiktok-shop/config";
import { kiemCron, ghiNhip } from "@/lib/tiktok-shop/cron-guard";
import { xuLySuKienCho } from "@/lib/tiktok-shop/events";
import { chayLichGiao, guiNhanDonGiaoTay } from "@/lib/tiktok-shop/order-flow";
import { docTokenRow } from "@/lib/tiktok-shop/token-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const chan = kiemCron(req); if (chan) return chan;
  if (!ttsConfigured()) return NextResponse.json({ ok: false, error: "chưa cấu hình TTS_APP_KEY/TTS_APP_SECRET" });
  if (!(await docTokenRow())) { await ghiNhip("tts_process_last", { ok: false, chuaUyQuyen: true }); return NextResponse.json({ ok: false, error: "chưa uỷ quyền TikTok Shop" }); }
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  if (dry) return NextResponse.json({ ok: true, dry: true, note: "dry: không xử lý gì, chỉ xác nhận route sống" });
  try {
    const suKien = await xuLySuKienCho(40);
    const giao = await chayLichGiao();
    const nhanTay = await guiNhanDonGiaoTay();
    const ok = suKien.loi === 0;
    await ghiNhip("tts_process_last", { ok, suKien, giao, nhanTay });
    return NextResponse.json({ ok, suKien, giao, nhanTay }, { status: ok ? 200 : 500 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[tts-process]", msg);
    await ghiNhip("tts_process_last", { ok: false, loi: msg.slice(0, 300) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
