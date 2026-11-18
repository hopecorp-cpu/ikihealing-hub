import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { xuLyLenhSeo, guiBotSeo, seoBotToken, TEN_BOT_SEO } from "@/lib/seo-agent";
import { APP_URL } from "@/lib/app-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const KEY_SECRET = "seo_bot_webhook_secret";
const tg = async (method: string, body: Record<string, unknown>) => {
  const r = await fetch(`https://api.telegram.org/bot${seoBotToken()}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  return (await r.json().catch(() => ({}))) as any;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = (process.env.CRON_SECRET || "").trim();
  const key = (url.searchParams.get("key") || "").trim();
  const tokenCfg = String((await getServiceClient().from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
  if (!(key && ((secret && key === secret) || (tokenCfg && key === tokenCfg)))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!seoBotToken()) return NextResponse.json({ ok: false, error: "Chưa có TELEGRAM_SEO_BOT_TOKEN trên Vercel" }, { status: 400 });

  const me = await tg("getMe", {});
  if (!me.ok) return NextResponse.json({ ok: false, error: `Khoá bot không hợp lệ: ${me.description || "getMe hỏng"}` }, { status: 400 });
  if (url.searchParams.get("setup") !== "go") {
    const wh = await tg("getWebhookInfo", {});
    return NextResponse.json({ ok: true, bot: me.result?.username, ten: me.result?.first_name, webhook: !!wh.result?.url, loiWebhook: wh.result?.last_error_message || null });
  }
  const sec = randomUUID().replace(/-/g, "");
  await setConfigValue(KEY_SECRET, sec, "Secret webhook của bot AI SEO example");
  const [ten, lenh, wh] = [
    await tg("setMyName", { name: TEN_BOT_SEO }),
    await tg("setMyCommands", { commands: [
      { command: "seo", description: "Báo cáo SEO ngay" },
      { command: "duyet", description: "Duyệt đề xuất: /duyet 1,3 hoặc /duyet het" },
      { command: "bo", description: "Bỏ đề xuất: /bo 2" },
      { command: "gio", description: "Giờ báo cáo: /gio 7,17" },
      { command: "sobai", description: "Số bài viết mỗi ngày: /sobai 5" },
      { command: "sodexuat", description: "Số đề xuất mỗi ngày: /sodexuat 10" },
      { command: "doithu", description: "Tên miền đối thủ: /doithu a.com b.vn" },
      { command: "dung", description: "Dừng tự động, bài nằm chờ duyệt" },
      { command: "chay", description: "Bật tự động: tự viết, tự chấm, tự đăng" },
      { command: "nguong", description: "Ngưỡng điểm để đăng: /nguong 95" },
      { command: "giup", description: "Danh sách lệnh" },
    ] }),
    await tg("setWebhook", { url: `${APP_URL}/api/telegram/seo`, secret_token: sec, allowed_updates: ["message"], drop_pending_updates: true }),
  ];

  const thu = await guiBotSeo(`${TEN_BOT_SEO} đã nối xong. Từ giờ báo cáo SEO về đây. Gõ /seo để xem báo cáo ngay, /giup để xem lệnh.`);
  return NextResponse.json({
    ok: !!wh.ok && thu.ok, bot: me.result?.username, datTen: !!ten.ok, menuLenh: !!lenh.ok, webhook: !!wh.ok,
    tinThu: thu.ok ? "đã gửi" : `CHƯA gửi được (${thu.loi}) — mở bot @${me.result?.username}, bấm Start rồi chạy lại`,
  }, { status: wh.ok && thu.ok ? 200 : 500 });
}

export async function POST(req: Request) {
  const sec = (await getConfigValue(KEY_SECRET).catch(() => null)) || "";
  if (!seoBotToken() || !sec || req.headers.get("x-telegram-bot-api-secret-token") !== sec) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const up: any = await req.json().catch(() => ({}));
  const msg = up?.message;
  const text = String(msg?.text || "").trim();
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();

  if (!text || !ceo || msg?.chat?.type !== "private" || String(msg?.from?.id || "") !== ceo) return NextResponse.json({ ok: true, ignored: true });
  try {
    const t = text.replace(/^\/start\b.*/i, "/giup").replace(/^\/(seo(@\w+)?\s*)?/i, "");
    const tl = await xuLyLenhSeo(`/seo ${t}`.trim());
    const g = await guiBotSeo(tl);
    if (!g.ok) throw new Error(g.loi);
  } catch (e: any) {
    await guiBotSeo(`Agent SEO lỗi: ${String(e?.message || e).slice(0, 200)}`).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
