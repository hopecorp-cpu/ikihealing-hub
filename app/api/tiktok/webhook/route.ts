import { NextResponse } from "next/server";
import { ttsConfig, ttsConfigured } from "@/lib/tiktok-shop/config";
import { xacMinhWebhook } from "@/lib/tiktok-shop/sign";
import { ghiSuKien, laSuKienQuyen, tenSuKien, type WebhookPayload } from "@/lib/tiktok-shop/events";
import { guiNhomTts, tgEscape } from "@/lib/tiktok-shop/telegram";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!ttsConfigured()) return NextResponse.json({ ok: false, error: "chưa cấu hình TTS_APP_KEY/TTS_APP_SECRET" }, { status: 503 });
  const c = ttsConfig();
  const raw = await req.text();
  if (!xacMinhWebhook(c.appKey, c.appSecret, raw, req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "sai chữ ký" }, { status: 401 });
  }
  let p: WebhookPayload;
  try { p = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "body không phải JSON" }, { status: 400 }); }

  try {
    const r = await ghiSuKien(p, raw);
    const ten = tenSuKien(p);

    const quyen = r.moi ? laSuKienQuyen(ten, p) : null;
    if (quyen) {
      const shop = tgEscape(String(p.shop_id || "?"));
      const het = Number(p.data?.expiration_time);
      const hetHan = Number.isFinite(het) && het > 0 ? ` (hết hạn ${new Date(het * 1000).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })})` : "";
      const text = quyen === "thu_hoi"
        ? `<b>TIKTOK SHOP ĐÃ THU HỒI QUYỀN</b> (shop ${shop}). Mọi cron TikTok sẽ hỏng. Mở lại link uỷ quyền trong docs/tiktok-shop-api.md.`
        : `<b>Quyền TikTok Shop SẮP HẾT HẠN</b> (shop ${shop})${tgEscape(hetHan)}. Mở lại link uỷ quyền trước hạn để không đứt đơn.`;

      void guiNhomTts(text);
      void sendTelegram(text);
    }
    return NextResponse.json({ ok: true, moi: r.moi, type: ten });
  } catch (e: any) {

    console.error("[tts webhook]", e?.message || e);
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, note: "Webhook TikTok Shop — chỉ nhận POST có chữ ký" });
}
