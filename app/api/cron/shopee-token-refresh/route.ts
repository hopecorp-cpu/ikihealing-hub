import { NextResponse } from "next/server";
import { setConfigValue } from "@/lib/app-config";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { shopeeChuaSan } from "@/lib/shopee/config";
import { canLamMoi } from "@/lib/shopee/auth";
import { docTokenShopee, lamMoiVaLuu } from "@/lib/shopee/token-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const nhip = (v: Record<string, unknown>) =>
  setConfigValue("shopee_token_last", JSON.stringify({ at: new Date().toISOString(), ...v }), "Nhịp tim shopee_token_last (Shopee API)").catch((e) => console.error("[shopee] ghi nhịp hỏng", e));

export async function GET(req: Request) {
  const chan = await chanMay(req, [khoaCron()]); if (chan) return chan;
  const chua = shopeeChuaSan();
  if (chua) return NextResponse.json({ ok: true, tat: true, lyDo: chua });
  const ep = new URL(req.url).searchParams.get("force") === "1";
  try {
    const rows = await docTokenShopee();
    if (!rows.length) { await nhip({ ok: false, chuaUyQuyen: true }); return NextResponse.json({ ok: false, error: "chưa uỷ quyền Shopee" }); }
    const ketQua: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const refreshConGio = Math.round((new Date(r.refresh_token_expires_at).getTime() - Date.now()) / 3600e3);
      if (refreshConGio <= 0) { ketQua.push({ shopId: r.shop_id, ok: false, loi: "refresh token đã hết hạn — phải uỷ quyền lại" }); continue; }
      if (!ep && !canLamMoi(r.access_token_expires_at)) { ketQua.push({ shopId: r.shop_id, ok: true, lamMoi: false }); continue; }
      try {
        const moi = await lamMoiVaLuu(r);
        ketQua.push({ shopId: r.shop_id, ok: true, lamMoi: true, accessHetHan: moi.access_token_expires_at, refreshHetHan: moi.refresh_token_expires_at });
      } catch (e: any) {
        ketQua.push({ shopId: r.shop_id, ok: false, loi: String(e?.message || e).slice(0, 300) });
      }
    }
    const ok = ketQua.every((k) => k.ok);
    await nhip({ ok, ketQua });
    return NextResponse.json({ ok, ketQua }, { status: ok ? 200 : 500 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[shopee-token-refresh]", msg);
    await nhip({ ok: false, loi: msg.slice(0, 300) });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
