import { readFileSync } from "fs";
import { join } from "path";
import { vnDateStr } from "@/lib/payroll";
import { saleKpiTarget } from "@/lib/payroll";
import { norm } from "@/lib/sale-metrics";
import { loadOrderOverrides, effectiveSaleName } from "@/lib/order-attribution";
import { layDoanhThu, gopTenSale, tuoiNguonDon } from "@/lib/doanh-thu";

const VAT = 1.08;

export type Light = "green" | "yellow" | "red";
export type SaleKpiRow = { name: string; short: string; pct: number; netMonth: number; ordersYest: number };
export type CockpitData = {
  today: string; yest: string; month: string;
  fin: { light: Light; revMonthGross: number; target: number; pct: number; expectedPct: number; margin: number | null };
  biz: { light: Light; ordersYest: number; revYestGross: number; sales: SaleKpiRow[]; needCare: number };
  hr: { light: Light; attToday: number; activeStaff: number; leavesPending: number; checklistOk: number; checklistTotal: number };
  ops: { light: Light; stockOut: number; stockLow: number; misaOk: boolean; misaLatest: string | null; jtReturned: number; ckHold: number };
  alerts: string[];
  priority: string;
};

export async function computeCockpit(sb: any): Promise<CockpitData> {
  const today = vnDateStr();
  const yest = vnDateStr(new Date(Date.now() - 24 * 3600e3));
  const month = today.slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const expectedPct = Math.round(+today.slice(8, 10) / dim * 100);

  const cfg = async (key: string) => { try { const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle(); return data?.value ?? null; } catch { return null; } };

  const ov = await loadOrderOverrides(sb);
  const li = (await layDoanhThu(sb, `${month}-01`, today)).rows;
  const revMonthNet = li.reduce((s: number, r: any) => s + (r.net_amount || 0), 0);
  const yestRows = li.filter((r: any) => r.order_date === yest);
  const ordersYest = new Set(yestRows.map((r: any) => r.order_code)).size;
  const revYestNet = yestRows.reduce((s: number, r: any) => s + (r.net_amount || 0), 0);

  const annual = Number(await cfg("annual_revenue_target_2026")) || 9e9;
  const target = annual / 12;
  const pct = target ? Math.round(revMonthNet * VAT / target * 100) : 0;
  let margin: number | null = null;
  try {

    const { data: dp } = await sb.from("misa_daily_profit").select("revenue,gross_profit").gte("ref_date", `${month}-01`);
    const rev = (dp || []).reduce((s: number, r: any) => s + (r.revenue || 0), 0);
    const gp = (dp || []).reduce((s: number, r: any) => s + (r.gross_profit || 0), 0);
    if (rev > 0) margin = Math.round(gp / rev * 100);
  } catch { }
  const finLight: Light = pct >= expectedPct - 5 ? "green" : pct >= expectedPct - 15 ? "yellow" : "red";

  const { data: users } = await sb.from("users").select("id, full_name, position, active, role, departments!users_department_id_fkey(name)").eq("active", true);
  const saleUsers = (users || []).filter((u: any) => u.departments?.name === "Kinh Doanh & Sale" && /sale/i.test(u.position || ""));

  const gopTen = gopTenSale((users || []).filter((u: any) => u.full_name).map((u: any) => ({ ten: u.full_name })));
  const byEff: Record<string, { net: number; yestOrders: Set<string> }> = {};
  for (const r of li) {
    if (ov.excluded.has(r.order_code)) continue;
    const k = norm(gopTen(effectiveSaleName(r.order_code, r.sale_name || "", ov))); if (!k) continue;
    const s = (byEff[k] ??= { net: 0, yestOrders: new Set() });
    s.net += r.net_amount || 0;
    if (r.order_date === yest) s.yestOrders.add(r.order_code);
  }
  const sales: SaleKpiRow[] = saleUsers.map((u: any) => {
    const k = norm(u.full_name || "");

    const netMonth = Math.round(byEff[k]?.net || 0);
    const kpi = saleKpiTarget(u.position);
    const parts = (u.full_name || "").trim().split(/\s+/);
    return { name: u.full_name, short: parts[parts.length - 1] || u.full_name, pct: kpi ? Math.round(netMonth / kpi * 100) : 0, netMonth, ordersYest: byEff[k]?.yestOrders.size || 0 };
  }).sort((a: SaleKpiRow, b: SaleKpiRow) => b.netMonth - a.netMonth);
  let needCare = 0; try { needCare = JSON.parse(await cfg("care_summary") || "{}").needCare || 0; } catch { }
  const zeroSales = sales.filter(s => s.ordersYest === 0);
  const bizLight: Light = ordersYest === 0 ? "red" : zeroSales.length ? "yellow" : "green";

  const activeStaff = (users || []).length;
  let attToday = 0, leavesPending = 0;
  try { const { count } = await sb.from("attendance").select("id", { count: "exact", head: true }).eq("date", today); attToday = count || 0; } catch { }
  try { const { count } = await sb.from("leaves").select("id", { count: "exact", head: true }).eq("status", "pending"); leavesPending = count || 0; } catch { }

  let checklistOk = 0; const checklistTotal = saleUsers.length;
  try {
    const { data: docs } = await sb.from("config").select("key, value").ilike("key", `salecheck_${yest}__%`);
    for (const row of docs || []) { try { const d = JSON.parse(row.value); if (!(d.missing || []).length) checklistOk++; } catch { } }
    checklistOk = Math.min(checklistOk, checklistTotal);
  } catch { }
  const hrLight: Light = leavesPending > 0 || (checklistTotal > 0 && checklistOk < checklistTotal) ? "yellow" : "green";

  let stockOut = 0, stockLow = 0;
  try {
    const stock = JSON.parse(readFileSync(join(process.cwd(), "data/warehouse-stock.json"), "utf8")).items || [];
    stockOut = stock.filter((s: any) => s.closing <= 0).length;
    stockLow = stock.filter((s: any) => s.closing > 0 && s.closing <= 10).length;
  } catch { }
  let misaOk = true; try { const st = JSON.parse(await cfg("misa_session_status") || "null"); if (st && st.ok === false) misaOk = false; } catch { }

  const tuoi = await tuoiNguonDon(sb);
  const misaLatest = tuoi.misaToi;
  let jtReturned = 0; try { const { count } = await sb.from("jt_waybills").select("*", { count: "exact", head: true }).eq("status_group", "returned").gte("order_create_time", `${month}-01 00:00:00`); jtReturned = count || 0; } catch { }

  let ckHold = 0;
  try {
    const from14 = vnDateStr(new Date(Date.now() - 14 * 86400e3));
    const { data: reps } = await sb.from("daily_reports").select("fields").gte("report_date", from14);
    for (const r of reps || []) { const cks = r.fields?.ck_deposits; if (Array.isArray(cks)) ckHold += cks.filter((c: any) => c.st === "hold").length; }
  } catch { }
  const misaStale = tuoi.muSo;
  const opsLight: Light = misaStale || stockOut >= 20 ? "red" : stockOut > 0 || stockLow > 0 || jtReturned > 0 ? "yellow" : "green";

  const alerts: string[] = [];

  if (tuoi.muSo) alerts.push(`MÙ SỐ: sổ đơn Telegram cũ (${tuoi.teleToi || "trống"}) — số bán hàng hiện KHÔNG đáng tin`);
  if (pct < expectedPct - 5) alerts.push(`Doanh số chậm nhịp mục tiêu (${pct}% vs ${expectedPct}% theo lịch)`);
  if (stockOut > 0) alerts.push(`Kho: ${stockOut} mã hết hàng${stockLow ? ` + ${stockLow} sắp hết` : ""} — cần đặt nhập`);
  for (const s of zeroSales) alerts.push(`${s.name} chưa có đơn nào hôm qua`);
  try { const f = JSON.parse(await cfg("fb_unreplied") || "{}"); if ((f.total || 0) > 0) alerts.push(`${f.total} khách Facebook chưa được trả lời`); } catch { }
  try { const u = JSON.parse(await cfg("sale_unreplied") || "{}"); if ((u.total || 0) > 0) alerts.push(`${u.total} khách Zalo chờ sale trả lời`); } catch { }
  if (ckHold > 0) alerts.push(`${ckHold} đơn CK đủ tiền đang GIỮ HÀNG chờ khách hẹn gửi`);

  const priority = pct < expectedPct - 5
      ? "Đẩy chốt đơn — doanh số đang chậm nhịp mục tiêu tháng."
      : needCare > 20
        ? `Phân bổ chăm sóc ${needCare} khách sắp tới chu kỳ tái mua cho ${saleUsers.length || 3} sale.`
        : "Giữ nhịp — rà đơn kho lên có khớp báo cáo sale không.";

  return {
    today, yest, month,
    fin: { light: finLight, revMonthGross: Math.round(revMonthNet * VAT), target: Math.round(target), pct, expectedPct, margin },
    biz: { light: bizLight, ordersYest, revYestGross: Math.round(revYestNet * VAT), sales, needCare },
    hr: { light: hrLight, attToday, activeStaff, leavesPending, checklistOk, checklistTotal },
    ops: { light: opsLight, stockOut, stockLow, misaOk, misaLatest, jtReturned, ckHold },
    alerts, priority,
  };
}
