import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, getConfigNumber, setConfigValue } from "@/lib/app-config";
import { sendTelegramMay, tgEscape } from "@/lib/telegram";
import { vnDateStr, saleKpiTarget } from "@/lib/payroll";
import { layDoanhThu, tuoiNguonDon } from "@/lib/doanh-thu";
import { getSaleMetricsFull } from "@/lib/sale-metrics";
import { buildMonthlyTargets2026, CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026, MONTHLY_TARGET_OVERRIDES_KEY } from "@/lib/bi-targets";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const fmt = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) + "%" : "?");
const tenGon = (s: string) => { const p = (s || "").trim().split(/\s+/); return p[p.length - 1] || "?"; };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";
  const chan = await chanMay(req, [khoaCron()]);
  if (chan) return chan;

  const today = vnDateStr();
  const month = today.slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  if (!force && +today.slice(8, 10) !== dim) return NextResponse.json({ ok: true, skip: `${today} không phải ngày cuối tháng` });

  const sentKey = `chot_dt_thang_sent_${month}`;
  if (!dry && !force && (await getConfigValue(sentKey)) === "1") return NextResponse.json({ ok: true, skip: "đã gửi tháng này" });

  const sb = getServiceClient();
  const tu = `${month}-01`;
  const prev = new Date(`${tu}T00:00:00Z`); prev.setUTCMonth(prev.getUTCMonth() - 1);
  const pm = prev.toISOString().slice(0, 7);
  const pmDim = new Date(+pm.slice(0, 4), +pm.slice(5, 7), 0).getDate();

  const [dt, dtTruoc, sm, tuoi, annual, ovRaw] = await Promise.all([
    layDoanhThu(sb, tu, today, { si: "loai" }),
    layDoanhThu(sb, `${pm}-01`, `${pm}-${String(pmDim).padStart(2, "0")}`, { si: "loai" }),
    getSaleMetricsFull(month).catch(() => null),
    tuoiNguonDon(sb).catch(() => null),
    getConfigNumber(CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026),
    getConfigValue(MONTHLY_TARGET_OVERRIDES_KEY).catch(() => null),
  ]);

  const net = dt.rows.reduce((s, r) => s + (r.net_amount || 0), 0);
  const soDon = new Set(dt.rows.map((r) => r.order_code)).size;
  const netTruoc = dtTruoc.rows.reduce((s, r) => s + (r.net_amount || 0), 0);

  let target = 0;
  if (month.startsWith("2026-")) {
    let ov: Record<string, number> | undefined;
    try { ov = ovRaw ? JSON.parse(ovRaw) : undefined; } catch { ov = undefined; }
    target = buildMonthlyTargets2026(annual, {}, month, ov).rows.find((r) => r.month === month)?.target || 0;
  }

  const sp: Record<string, { ten: string; tien: number }> = {};
  for (const r of dt.rows) {
    const ten = (r.product_name || "?").trim().replace(/\s+/g, " ");
    (sp[ten.toLowerCase()] ||= { ten, tien: 0 }).tien += r.net_amount || 0;
  }
  const topSp = Object.values(sp).sort((a, b) => b.tien - a.tien).slice(0, 5).map((x) => [x.ten, x.tien] as const);

  const L: string[] = [
    `<b>CHỐT DOANH THU THÁNG ${month.slice(5)}/${month.slice(0, 4)}</b> (tạm chốt ${today}, số NET đã trừ VAT, bán lẻ)`,
    ``,
    `Doanh thu: <b>${fmt(net)}</b> · ${soDon} đơn · TB ${fmt(soDon ? net / soDon : 0)}/đơn`,
    target ? `Mục tiêu tháng: ${fmt(target)} → đạt <b>${pct(net, target)}</b>${net < target ? ` (thiếu ${fmt(target - net)})` : ""}` : `Mục tiêu tháng: chưa đặt`,
    `Tháng trước (${pm.slice(5)}): ${fmt(netTruoc)} → ${netTruoc > 0 ? `${net >= netTruoc ? "tăng" : "giảm"} ${Math.abs(Math.round(((net - netTruoc) / netTruoc) * 100))}%` : "không có số để so"}`,
    `Đơn sỉ/đại lý (tách riêng): ${dt.donSi || 0} đơn · ${fmt(dt.netSi || 0)}`,
  ];

  if (sm?.metrics?.length) {

    L.push(``, `<b>Theo sale (so KPI):</b>`);
    for (const m of sm.metrics.slice().sort((a, b) => b.revenue - a.revenue)) {
      const kpi = saleKpiTarget(m.position);
      L.push(`• ${tgEscape(tenGon(m.name))}: ${fmt(m.revenue)} / KPI ${fmt(kpi)} → <b>${pct(m.revenue, kpi)}</b> · ${m.orders} đơn`);
    }
    if (sm.chuaRo.don > 0) L.push(`• Chưa gán sale: ${fmt(sm.chuaRo.net)} · ${sm.chuaRo.don} đơn (cần gán trước khi chốt lương)`);
  } else {
    L.push(``, `Theo sale: không đọc được chỉ số sale — xem /kpi.`);
  }

  if (topSp.length) {
    L.push(``, `<b>Top sản phẩm:</b>`);
    for (const [p, v] of topSp) L.push(`• ${tgEscape(p.length > 36 ? p.slice(0, 35) + "…" : p)}: ${fmt(v)}`);
  }

  const canhBao = [...(dt.canhBao || []), ...(tuoi?.canhBao || []).filter((c) => /^Sổ đơn Telegram/.test(c))];
  if (tuoi?.teleToi) canhBao.unshift(`Sổ đơn bóc tới ${tuoi.teleToi}.`);
  if (canhBao.length) L.push(``, ...canhBao.map((c) => `Lưu ý: ${tgEscape(c)}`));
  L.push(``, `Đơn chốt sau giờ này và tin chưa bóc sẽ vào bản chính thức sáng mùng 1 (báo cáo tháng).`);

  const text = L.join("\n");
  if (dry) return NextResponse.json({ ok: true, dry: true, net, soDon, target, netTruoc, text });
  const t = await sendTelegramMay("tai-chinh", text);
  if (t.ok && !force) await setConfigValue(sentKey, "1", `Đã gửi chốt doanh thu cuối tháng ${month}`);
  return NextResponse.json({ ok: t.ok, net, soDon, target, netTruoc, telegram: t });
}
