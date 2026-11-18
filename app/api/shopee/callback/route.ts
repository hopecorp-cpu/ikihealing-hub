import { NextResponse } from "next/server";
import { vuotGioiHan } from "@/lib/chan-spam";
import { shopeeChuaSan, shopeeConfig } from "@/lib/shopee/config";
import { doiCodeShopee } from "@/lib/shopee/auth";
import { ghiTokenShopee } from "@/lib/shopee/token-store";
import { sendTelegram, tgEscape } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = (u.searchParams.get("code") || "").trim();
  const shopId = Number(u.searchParams.get("shop_id"));
  const chu = (s: string, status = 200) => new NextResponse(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

  const chua = shopeeChuaSan();
  if (chua) return chu(`${chua}.`, 503);
  if (!code) return chu("Thiếu tham số code. Mở lại link uỷ quyền /api/shopee/uy-quyen.", 400);
  if (!shopId) {
    return chu(u.searchParams.get("main_account_id")
      ? "Shopee trả main_account_id (tài khoản chính nhiều shop) — bản này chỉ nhận uỷ quyền từng shop. Đăng nhập bằng tài khoản shop rồi uỷ quyền lại."
      : "Thiếu shop_id. Mở lại link uỷ quyền /api/shopee/uy-quyen.", 400);
  }

  if (await vuotGioiHan(req, "shopee-callback", { moiIpMoiGio: 5, tongMoiNgay: 20 })) return chu("Thử lại sau.", 429);

  try {
    const c = shopeeConfig();
    const row = await ghiTokenShopee(await doiCodeShopee(c, code, shopId));
    const dong = [
      "UỶ QUYỀN SHOPEE THÀNH CÔNG.",
      `Shop ID: ${row.shop_id} · môi trường ${c.moiTruong}`,
      `Access token hết hạn: ${row.access_token_expires_at}`,
      `Refresh token hết hạn: ${row.refresh_token_expires_at}`,
      "Có thể đóng tab này. Cron shopee-token-refresh tự làm mới mỗi giờ.",
    ].join("\n");
    void sendTelegram(`<b>Shopee đã uỷ quyền</b>\n${tgEscape(dong)}`);
    return chu(dong);
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[shopee callback]", msg);
    void sendTelegram(`<b>Shopee uỷ quyền THẤT BẠI</b>\n${tgEscape(msg.slice(0, 400))}`);
    return chu("Uỷ quyền thất bại.\nCode chỉ dùng được một lần — mở lại /api/shopee/uy-quyen để lấy code mới.", 500);
  }
}
