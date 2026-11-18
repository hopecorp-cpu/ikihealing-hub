import { NextResponse } from "next/server";
import { ttsConfigured } from "@/lib/tiktok-shop/config";
import { kiemCron, ghiNhip } from "@/lib/tiktok-shop/cron-guard";
import { searchOrders } from "@/lib/tiktok-shop/api";
import { dongBoDon } from "@/lib/tiktok-shop/order-flow";
import { docTokenRow, layShopCipher, layTokenHopLe } from "@/lib/tiktok-shop/token-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const chan = kiemCron(req); if (chan) return chan;
  if (!ttsConfigured()) return NextResponse.json({ ok: false, error: "chưa cấu hình TTS_APP_KEY/TTS_APP_SECRET" });
  if (!(await docTokenRow())) { await ghiNhip("tts_poll_last", { ok: false, chuaUyQuyen: true }); return NextResponse.json({ ok: false, error: "chưa uỷ quyền TikTok Shop" }); }
  const u = new URL(req.url);
  const phut = Math.min(Math.max(Number(u.searchParams.get("phut")) || 60, 5), 24 * 60 * 7);
  const dry = u.searchParams.get("dry") === "1";
  try {
    const row = await layTokenHopLe();
    const shop = await layShopCipher(row);
    const tuGiay = Math.floor(Date.now() / 1000) - phut * 60;
    const ids: string[] = [];
    let pageToken: string | undefined;
    for (let trang = 0; trang < 10; trang++) {
      const d = await searchOrders({ update_time_ge: tuGiay }, { pageSize: 50, pageToken });
      for (const o of d?.orders || []) if (o?.id) ids.push(String(o.id));
      pageToken = d?.next_page_token || undefined;
      if (!pageToken) break;
    }
    if (dry) return NextResponse.json({ ok: true, dry: true, phut, soDon: ids.length, ids: ids.slice(0, 20) });
    const rows = await dongBoDon(ids, shop.shopId);
    const theoTrangThai: Record<string, number> = {};
    for (const r of rows) theoTrangThai[r.status || "?"] = (theoTrangThai[r.status || "?"] || 0) + 1;
    await ghiNhip("tts_poll_last", { ok: true, phut, soDon: rows.length, theoTrangThai });
    return NextResponse.json({ ok: true, phut, soDon: rows.length, theoTrangThai });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[tts-poll]", msg);
    await ghiNhip("tts_poll_last", { ok: false, loi: msg.slice(0, 300) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
