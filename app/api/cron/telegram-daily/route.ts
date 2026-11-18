import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegramMay, telegramConfigured, tgEscape } from "@/lib/telegram";
import { vnDateStr } from "@/lib/payroll";
import { layDoanhThu, doanhThuTheoSale, tuoiNguonDon } from "@/lib/doanh-thu";
import { activeSales, getLeadConfig } from "@/lib/leads";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

const fmt = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";

const tenGon = (s: string) => {
  const t = s.trim();
  if (!t || /^chưa rõ$/i.test(t)) return "Chưa gán sale";
  const parts = t.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : t;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, error: "Chưa cấu hình TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID trong Vercel env" });
  }

  const sb = getServiceClient();
  const today = vnDateStr();
  const month = today.slice(0, 7);
  const mStart = `${month}-01`;

  const [homNay, thang, sales, leadCfg, tuoi, chuaBoc] = await Promise.all([
    layDoanhThu(sb, today, today),
    doanhThuTheoSale(sb, mStart, today, {}),
    activeSales(sb).catch(() => []),
    getLeadConfig().catch(() => null),
    tuoiNguonDon(sb).catch(() => null),
    (async (): Promise<number | null> => {
      try { const r: any = await sb.from("tg_messages").select("id", { count: "exact", head: true }).eq("da_boc", false); return r?.count ?? null; }
      catch { return null; }
    })(),
  ]);
  const rows = homNay.rows;

  const totalToday = rows.reduce((s, r) => s + (r.net_amount || 0), 0);
  const ordersToday = new Set(rows.map((r) => r.order_code)).size;

  const bySale: Record<string, { rev: number; orders: Set<string> }> = {};
  for (const r of rows) {
    const s = tenGon(r.sale_name || "");
    (bySale[s] ??= { rev: 0, orders: new Set() });
    bySale[s].rev += r.net_amount || 0;
    bySale[s].orders.add(r.order_code);
  }
  const saleLines = Object.entries(bySale).sort((a, b) => b[1].rev - a[1].rev)
    .map(([s, v]) => `• ${tgEscape(s)} — <b>${fmt(v.rev)}</b> (${v.orders.size} đơn)`);

  const byProduct: Record<string, number> = {};
  for (const r of rows) { const p = (r.product_name || "?").trim(); byProduct[p] = (byProduct[p] || 0) + (r.net_amount || 0); }
  const topProd = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([p, v]) => `• ${tgEscape(p.length > 34 ? p.slice(0, 33) + "…" : p)} — ${fmt(v)}`);

  const mtd = thang.theoSale.reduce((s, x) => s + x.net, 0) + thang.chuaRo.net;
  const mtdOrders = thang.theoSale.reduce((s, x) => s + x.don, 0) + thang.chuaRo.don;
  const mtdSale = thang.theoSale.slice().sort((a, b) => b.net - a.net)
    .map((x) => `• ${tgEscape(tenGon(x.ten))} — <b>${fmt(x.net)}</b> (${x.don} đơn)`);
  if (thang.chuaRo.don > 0) mtdSale.push(`• Chưa gán sale — <b>${fmt(thang.chuaRo.net)}</b> (${thang.chuaRo.don} đơn)`);

  const lines = [
    `\u{1F4CA} <b>BÁO CÁO BÁN HÀNG</b> — ${today}`,
    `(số NET đã trừ VAT, nguồn: sổ đơn nhóm Telegram)`,
    ``,
    `\u{1F4B0} Doanh thu hôm nay: <b>${fmt(totalToday)}</b>`,
    `\u{1F9FE} Số đơn: <b>${ordersToday}</b>`,
    ``,
    `\u{1F464} <b>Theo sale hôm nay:</b>`,
    ...(saleLines.length ? saleLines : ["• (chưa có đơn hôm nay)"]),
  ];
  if (topProd.length) { lines.push(``, `\u{1F3C6} <b>Top sản phẩm:</b>`, ...topProd); }
  lines.push(``, `\u{1F4C5} Lũy kế tháng ${month}: <b>${fmt(mtd)}</b> · ${mtdOrders} đơn`, ...mtdSale);

  const tuoiTxt: string[] = [];
  if (tuoi?.teleToi) tuoiTxt.push(`sổ đơn bóc tới ${tuoi.teleToi}`);
  if (chuaBoc != null && chuaBoc > 0) tuoiTxt.push(`${chuaBoc} tin trong nhóm chưa bóc (cron bóc :05/:35)`);
  if (tuoiTxt.length) lines.push(``, `\u{23F1} Độ tươi: ${tuoiTxt.join(" · ")}`);

  const canhBao = [...(homNay.canhBao || []), ...(tuoi?.canhBao || []).filter((c) => /^Sổ đơn Telegram/.test(c))];
  for (const c of canhBao) lines.push(`\u{26A0}\u{FE0F} ${tgEscape(c)}`);

  const dayNum = Number(today.slice(8, 10)) || 1;
  const dailyAvg = dayNum > 0 ? mtd / dayNum : 0;
  const activeToday = new Set(Object.keys(bySale));

  const loai = new Set(leadCfg?.excludeFromPool || []);
  const doiSale = (sales as Array<{ id: string; name: string }>).filter((s) => !loai.has(s.id)).map((s) => tenGon(s.name)).filter(Boolean);
  const missing = doiSale.filter((s) => !activeToday.has(s));
  const props: string[] = [];
  if (tuoi && tuoi.teleTre != null && tuoi.teleTre > 2) props.push(`Sổ đơn Telegram cũ ${tuoi.teleTre} ngày — con số hôm nay KHÔNG đáng tin, kiểm cron tg-boc-don trước khi kết luận bán chậm.`);
  if (missing.length) props.push(`Chưa có đơn hôm nay từ: ${missing.join(", ")} → nhắc gọi/chốt tệp đang chờ.`);
  if (dayNum > 1 && dailyAvg > 0 && totalToday < dailyAvg * 0.6) props.push(`Doanh thu hôm nay thấp hơn ~40% nhịp TB tháng (${fmt(dailyAvg)}/ngày) → đẩy chăm sóc + chốt trong hôm nay/mai.`);
  if (ordersToday > 0) props.push(`Nhắc sale gợi combo/quà kèm để tăng giá trị đơn (AOV).`);
  if (!props.length) props.push("Nhịp bán ổn định — tiếp tục theo dõi, chưa cần đổi gì.");
  lines.push(``, `\u{1F4A1} <b>ĐỀ XUẤT</b> (chờ anh duyệt — nhắn em làm):`, ...props.map((p, i) => `${i + 1}. ${p}`));

  const text = lines.join("\n");
  if (dry) return NextResponse.json({ ok: true, dry: true, totalToday, ordersToday, mtd, mtdOrders, text });
  const r = await sendTelegramMay("bao-cao-ban-hang", text);
  return NextResponse.json({ ok: r.ok, totalToday, ordersToday, mtd, mtdOrders, sale: Object.keys(bySale).length, nguon: { tele: homNay.ngayTele.length, misa: homNay.ngayMisa.length }, telegram: r });
}
