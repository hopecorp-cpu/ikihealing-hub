import { NextResponse } from "next/server";
import { appLink, APP_HOST } from "@/lib/app-url";
import { getServiceClient } from "@/lib/supabase-server";
import { sendSaleTelegram, saleBotGetUpdates, saleBotConfigured, tgEscape } from "@/lib/telegram";
import { vnDateStr } from "@/lib/payroll";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  if (!saleBotConfigured()) return NextResponse.json({ ok: false, error: "Chưa cấu hình TELEGRAM_SALE_BOT_TOKEN / _USERNAME" });

  const sendTo = new URL(req.url).searchParams.get("send");
  if (sendTo) {
    const r = await sendSaleTelegram(sendTo, "\u{1F514} <b>Test bot nhắc chăm sóc ACME</b>\nBot đã kết nối. Mỗi sáng bạn sẽ nhận danh sách khách tới hạn chăm ở đây.");
    return NextResponse.json({ ok: r.ok, telegram: r });
  }

  const sb = getServiceClient();
  const getCfg = async (k: string) => (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value ?? null;
  const setCfg = (k: string, v: string) => sb.from("config").upsert({ key: k, value: v }, { onConflict: "key" });

  let offset = Number(await getCfg("sale_tg_offset")) || 0;
  let chatMap: Record<string, string> = {};
  try { chatMap = JSON.parse((await getCfg("sale_tg_chat")) || "{}"); } catch { }
  let pending: Record<string, string> = {};
  try { pending = JSON.parse((await getCfg("sale_tg_pending")) || "{}"); } catch { }
  let registered = 0;
  const upd = await saleBotGetUpdates(offset);
  for (const u of upd.result) {
    if (u.update_id != null) offset = Math.max(offset, u.update_id + 1);
    const text = u.message?.text || "";
    const chatId = u.message?.chat?.id;
    const from = u.message?.from || {};
    if (!chatId || !/^\/start/.test(text)) continue;
    const m = text.match(/^\/start\s+(\S+)/);
    if (m) { chatMap[String(m[1])] = String(chatId); registered++; delete pending[String(chatId)]; }
    else pending[String(chatId)] = `${from.first_name || ""} ${from.last_name || ""}`.trim() || String(chatId);
  }
  if (upd.result.length) {
    await setCfg("sale_tg_offset", String(offset));
    await setCfg("sale_tg_pending", JSON.stringify(pending));
    if (registered > 0) await setCfg("sale_tg_chat", JSON.stringify(chatMap));
  }

  const today = vnDateStr();
  const { data: careRows } = await sb.from("customer_care_log")
    .select("sale_name, customer_name, customer_phone, next_due, status")
    .lte("next_due", today).neq("status", "done");
  const dueBySale: Record<string, { n: number; names: string[] }> = {};
  for (const r of careRows || []) {
    const k = norm(r.sale_name || ""); if (!k) continue;
    const g = (dueBySale[k] ??= { n: 0, names: [] });
    g.n++; if (g.names.length < 5) g.names.push((r.customer_name || r.customer_phone || "?").toString().slice(0, 20));
  }

  const { data: users } = await sb.from("users").select("id, full_name").eq("active", true);
  let sent = 0;
  const results: any[] = [];
  for (const u of users || []) {
    const chatId = chatMap[String(u.id)]; if (!chatId) continue;
    const due = dueBySale[norm(u.full_name)];
    if (!due || !due.n) continue;
    const lines = [
      `\u{1F514} <b>NHẮC CHĂM SÓC</b> — ${today}`,
      ``,
      `Hôm nay bạn có <b>${due.n} khách tới hạn chăm</b>:`,
      ...due.names.map((n) => `• ${tgEscape(n)}`),
      due.n > due.names.length ? `… và ${due.n - due.names.length} khách nữa` : "",
      ``,
      `Chăm xong nhớ bấm <b>"Đã chăm"</b> để khỏi trùng: <a href="${appLink("/khach-360")}">mở hồ sơ khách</a>`,
    ].filter(Boolean);
    const r = await sendSaleTelegram(chatId, lines.join("\n"));
    if (r.ok) sent++;
    results.push({ sale: u.full_name, due: due.n, ok: r.ok });
  }

  return NextResponse.json({ ok: true, registered, connectedSales: Object.keys(chatMap).length, pendingUnmapped: Object.keys(pending).length, sent, results });
}
