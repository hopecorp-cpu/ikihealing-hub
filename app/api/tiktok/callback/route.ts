import { NextResponse } from "next/server";
import { vuotGioiHan } from "@/lib/chan-spam";
import { ttsConfigured } from "@/lib/tiktok-shop/config";
import { doiAuthCode, layShopCipher } from "@/lib/tiktok-shop/token-store";
import { sendTelegram, tgEscape } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = (u.searchParams.get("code") || u.searchParams.get("auth_code") || "").trim();
  const state = (u.searchParams.get("state") || "").trim();
  const chu = (s: string, status = 200) => new NextResponse(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

  if (!ttsConfigured()) return chu("TikTok Shop chưa cấu hình TTS_APP_KEY / TTS_APP_SECRET trên máy chủ.", 503);
  if (!code) return chu("Thiếu tham số code. Mở lại link uỷ quyền từ docs/tiktok-shop-api.md.", 400);

  if (await vuotGioiHan(req, "tiktok-callback", { moiIpMoiGio: 5, tongMoiNgay: 20 })) return chu("Thử lại sau.", 429);

  try {
    const row = await doiAuthCode(code);
    const shop = await layShopCipher(row, true);
    const dong = [
      "UỶ QUYỀN TIKTOK SHOP THÀNH CÔNG.",
      `Người bán: ${row.seller_name || "?"} · vùng ${row.region || "?"}`,
      `Shop: ${shop.name || shop.shopId} (${shop.region || "?"})`,
      `Access token hết hạn: ${row.access_token_expires_at}`,
      `Refresh token hết hạn: ${row.refresh_token_expires_at}`,
      `Scope: ${(row.scopes || []).join(", ") || "(TikTok không trả)"}`,
      state ? `state: ${state}` : "",
      "Có thể đóng tab này. Cron tts-poll sẽ tự kéo đơn trong 15 phút tới.",
    ].filter(Boolean).join("\n");
    void sendTelegram(`<b>TikTok Shop đã uỷ quyền</b>\n${tgEscape(dong)}`);
    return chu(dong);
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[tts callback]", msg);
    void sendTelegram(`<b>TikTok Shop uỷ quyền THẤT BẠI</b>\n${tgEscape(msg.slice(0, 400))}`);
    return chu(`Uỷ quyền thất bại.\nCode chỉ dùng được một lần và sống 30 phút — mở lại link uỷ quyền để lấy code mới.`, 500);
  }
}
