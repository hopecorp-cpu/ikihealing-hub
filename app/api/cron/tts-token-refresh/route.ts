import { NextResponse } from "next/server";
import { ttsConfigured } from "@/lib/tiktok-shop/config";
import { kiemCron, ghiNhip } from "@/lib/tiktok-shop/cron-guard";
import { docTokenRow, gioConLai, lamMoiToken } from "@/lib/tiktok-shop/token-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const chan = kiemCron(req); if (chan) return chan;
  if (!ttsConfigured()) return NextResponse.json({ ok: false, error: "chưa cấu hình TTS_APP_KEY/TTS_APP_SECRET" });
  const ep = new URL(req.url).searchParams.get("force") === "1";
  try {
    const row = await docTokenRow();
    if (!row) { await ghiNhip("tts_token_last", { ok: false, chuaUyQuyen: true }); return NextResponse.json({ ok: false, error: "chưa uỷ quyền TikTok Shop" }); }
    const conAccess = gioConLai(row.access_token_expires_at);
    const conRefresh = gioConLai(row.refresh_token_expires_at);
    let lamMoi = false;
    let moi = row;
    if (ep || conAccess < 48) { moi = await lamMoiToken(row); lamMoi = true; }
    const kq = { ok: true, lamMoi, accessConGio: Math.round(gioConLai(moi.access_token_expires_at)), refreshConGio: Math.round(conRefresh), canhBao: conRefresh < 7 * 24 ? "refresh token còn dưới 7 ngày — mở lại link uỷ quyền" : null };
    await ghiNhip("tts_token_last", kq);
    return NextResponse.json(kq);
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[tts-token-refresh]", msg);
    await ghiNhip("tts_token_last", { ok: false, loi: msg.slice(0, 300) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
