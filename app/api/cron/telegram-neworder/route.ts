import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegramMay, telegramConfigured, tgEscape } from "@/lib/telegram";
import { vnDateStr } from "@/lib/payroll";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

const fmt = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";
const SHORT: Record<string, string> = {
  "PHẠM VĂN SƠN": "Sơn", "Hoàng Thị Đào": "Đào", "Lê Thị Cúc": "Cúc",
  "Đỗ Thị Lan": "Lan", "HOC VIEN MAU": "Chưa gán",
};
const shortName = (s: string) => SHORT[s.trim()] || s.trim();

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "Chưa cấu hình Telegram env" });

  const sb = getServiceClient();
  const today = vnDateStr();

  const { data: rows } = await sb.from("tg_orders")
    .select("chat_id, message_id, khach_tra, sale, khach, san_pham")
    .eq("ngay", today);
  const orders: Record<string, { rev: number; sale: string; customer: string; items: string[] }> = {};
  for (const r of (rows || []) as any[]) {
    const c = `${r.chat_id}:${r.message_id}`;
    orders[c] = {
      rev: r.khach_tra || 0,
      sale: r.sale || "",
      customer: r.khach || "",
      items: Array.isArray(r.san_pham) ? r.san_pham.map((x: any) => String(x?.ten || "")).filter(Boolean) : [],
    };
  }
  const allCodes = Object.keys(orders);
  const tongNgay = Object.values(orders).reduce((s, o) => s + o.rev, 0);

  let wm: { date?: string; pinged?: string[] } = {};
  try { const { data } = await sb.from("config").select("value").eq("key", "tg_order_watermark").maybeSingle(); wm = JSON.parse(data?.value || "{}"); } catch { }

  if (wm.date !== today) {
    await sb.from("config").upsert({ key: "tg_order_watermark", value: JSON.stringify({ date: today, pinged: allCodes }) }, { onConflict: "key" });
    return NextResponse.json({ ok: true, seeded: allCodes.length, pinged: 0 });
  }

  const known = new Set(wm.pinged || []);
  const fresh = allCodes.filter(c => !known.has(c));
  if (!fresh.length) return NextResponse.json({ ok: true, pinged: 0 });

  const show = fresh.slice(0, 15);
  const lines = fresh.length === 1
    ? [`\u{1F6D2} <b>ĐƠN MỚI</b>`]
    : [`\u{1F6D2} <b>${fresh.length} ĐƠN MỚI</b>`];
  for (const c of show) {
    const o = orders[c];
    const prod = o.items.length ? tgEscape([...new Set(o.items)].slice(0, 3).join(", ").slice(0, 60)) : "";
    lines.push(`• <b>${fmt(o.rev)}</b> — ${tgEscape(shortName(o.sale) || "?")}${o.customer ? " — " + tgEscape(o.customer) : ""}${prod ? "\n   " + prod : ""}`);
  }
  if (fresh.length > show.length) lines.push(`… và ${fresh.length - show.length} đơn nữa`);

  lines.push(`\n<b>Cộng dồn hôm nay: ${fmt(tongNgay)}</b> · ${allCodes.length} đơn`);

  const r = await sendTelegramMay("don-moi", lines.join("\n"));

  if (r.ok) {
    await sb.from("config").upsert({ key: "tg_order_watermark", value: JSON.stringify({ date: today, pinged: [...known, ...fresh] }) }, { onConflict: "key" });
  }
  return NextResponse.json({ ok: r.ok, pinged: fresh.length, telegram: r });
}
