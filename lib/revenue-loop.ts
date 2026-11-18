import { getServiceClient } from "@/lib/supabase-server";
import { layDoanhThu } from "@/lib/doanh-thu";
import { getConfigValue, getConfigNumber, loadMonthlyTargetOverrides } from "@/lib/app-config";
import { CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026, buildMonthlyTargets2026, buildQuarterTargets, quarterOf, calcPace } from "@/lib/bi-targets";
import { decomposeTarget, planCombos, DEFAULT_COMBOS } from "@/lib/kpi-planner";
import { getAllSaleMetrics, norm, type SaleMetric } from "@/lib/sale-metrics";
import { loadOrderOverrides } from "@/lib/order-attribution";

export type Light = "green" | "yellow" | "red";

export type LoopAssumptions = {
  closeRate: number;
  ordersPerCustomer: number;
  grossMargin: number;
  desiredMargin: number;
  mktCostCapPct: number;
  workDaysPerMonth: number;
  weeksPerMonth: number;
};

export const DEFAULT_ASSUMPTIONS: LoopAssumptions = {
  closeRate: 0.15, ordersPerCustomer: 1, grossMargin: 0.66, desiredMargin: 0.30,
  mktCostCapPct: 0.15, workDaysPerMonth: 26, weeksPerMonth: 4.33,
};

export const LOOP_ASSUMPTIONS_KEY = "loop_assumptions";
export const mktSpendKey = (month: string) => `mkt_spend_${month}`;

export async function getLoopAssumptions(): Promise<LoopAssumptions> {
  try {
    const raw = JSON.parse((await getConfigValue(LOOP_ASSUMPTIONS_KEY)) || "{}");
    return {
      closeRate: clamp01(num(raw.closeRate, DEFAULT_ASSUMPTIONS.closeRate)),
      ordersPerCustomer: Math.max(0.1, num(raw.ordersPerCustomer, 1)),
      grossMargin: clamp01(num(raw.grossMargin, DEFAULT_ASSUMPTIONS.grossMargin)),
      desiredMargin: clamp01(num(raw.desiredMargin, DEFAULT_ASSUMPTIONS.desiredMargin)),
      mktCostCapPct: clamp01(num(raw.mktCostCapPct, DEFAULT_ASSUMPTIONS.mktCostCapPct)),
      workDaysPerMonth: Math.max(1, num(raw.workDaysPerMonth, 26)),
      weeksPerMonth: Math.max(1, num(raw.weeksPerMonth, 4.33)),
    };
  } catch { return { ...DEFAULT_ASSUMPTIONS }; }
}

export type AdCeilings = { gpPerOrder: number; cpoBreakeven: number; cpoCeiling: number; cplBreakeven: number; cplCeiling: number };
export function adCeilings(aovNet: number, grossMargin: number, desiredMargin: number, closeRate: number): AdCeilings {
  const gpPerOrder = aovNet * grossMargin;
  const cpoBreakeven = gpPerOrder;
  const cpoCeiling = gpPerOrder * (1 - desiredMargin);
  return { gpPerOrder, cpoBreakeven, cpoCeiling, cplBreakeven: cpoBreakeven * closeRate, cplCeiling: cpoCeiling * closeRate };
}

export type LoopSaleRow = {
  userId: string; name: string; position: string; rank: number;
  target: number; revenue: number; pct: number | null;
  orders: number; custs: number; aov: number;
  revLast: number; custsLast: number; ordersLast: number; aovLast: number;
  gap: number;
  ordersNeeded: number; customersNeeded: number; leadsNeeded: number;
  closeRateUsed: number; closeRateReal: number | null; chatScore: number | null;
  behind: boolean;
};

export type ChannelRow = { channel: string; revenue: number; orders: number; pctRev: number; leads?: number; convRate?: number | null };

export const leadsKey = (month: string) => `leads_${month}`;
const normCh = (s: string) => {
  const x = (s || "").toLowerCase().trim();
  if (/facebook|fb|mess/.test(x)) return "facebook";
  if (/zalo/.test(x)) return "zalo";
  if (/tiktok|tik tok/.test(x)) return "tiktok";
  if (/shopee/.test(x)) return "shopee";
  if (/lazada/.test(x)) return "lazada";
  if (/web|site|landing|sale ?page/.test(x)) return "website";
  if (/hotline|gọi|goi|call|điện|dien|phone/.test(x)) return "hotline";
  if (/trực tiếp|truc tiep|direct|walk|cửa hàng|cua hang|offline/.test(x)) return "trực tiếp";
  return x;
};
export type LeadsData = { byChannel: Record<string, number>; total: number; source: string; updatedAt?: string };
export async function loadLeads(month: string): Promise<LeadsData> {
  try {
    const d = JSON.parse((await getConfigValue(leadsKey(month))) || "{}");
    const raw = d.byChannel || {};
    const byChannel: Record<string, number> = {};
    let total = 0;
    for (const [k, v] of Object.entries(raw)) { const n = Number(v) || 0; if (n > 0) { byChannel[normCh(k)] = (byChannel[normCh(k)] || 0) + n; total += n; } }
    return { byChannel, total, source: d.source || "", updatedAt: d.updatedAt };
  } catch { return { byChannel: {}, total: 0, source: "" }; }
}

export type ProductMargin = { name: string; price: number; margin: number; line: string };

export type Recommendations = {
  gap: number;
  upsell: { combo: string; price: number; unitsNeeded: number; addRevenue: number } | null;
  crossSell: { product: string; price: number; marginPct: number; attachTo: number; addRevenue: number } | null;
  downsell: { combo: string; price: number; note: string } | null;
  gift: { savingsVsDiscount10: number; totalGiftCost: number } | null;
  topMargin: ProductMargin[];
};

export type RevenueLoopData = {
  month: string; prevMonth: string;
  assumptions: LoopAssumptions;

  annualTarget: number; monthTarget: number; monthActual: number;
  quarter: { q: number; label: string; target: number; actual: number; pct: number | null };
  pacePct: number; expectedPct: number; projectedPct: number; finLight: Light;
  daysElapsed: number; totalDays: number;

  sales: LoopSaleRow[];
  teamAov: number; totalOrders: number; totalCustomers: number;
  needGap: number; needOrders: number; needCustomers: number; needLeads: number;

  opcReal: number | null; closeRateRealTeam: number | null;

  ceil: AdCeilings; aovNet: number; budgetNeeded: number; budgetBreakeven: number;

  mktSpend: number; mktPct: number | null; mktCapAmount: number; mktHeadroom: number; mktLight: Light; mktOverBudgetWarn: boolean;

  channels: ChannelRow[]; chatAvg: number | null; callCloseReal: number | null;
  leadsTotal: number; leadsSource: string;

  reco: Recommendations;
};

const num = (v: any, d: number) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const isCur = (month: string) => month === new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
function prevMonthOf(month: string): string {
  const y = +month.slice(0, 4), m = +month.slice(5, 7);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
const monthRange = (m: string) => { const dim = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(); return [`${m}-01`, `${m}-${String(dim).padStart(2, "0")}`, dim] as const; };

async function realCloseRates(month: string): Promise<Record<string, { calls: number; chot: number }>> {
  const out: Record<string, { calls: number; chot: number }> = {};
  try {
    const cl = JSON.parse((await getConfigValue("call_log")) || "{}");
    for (const [d, bysale] of Object.entries(cl)) {
      if (!d.startsWith(month)) continue;
      for (const [sale, v] of Object.entries(bysale as any)) {
        const k = norm(sale); if (!k) continue;
        const calls = typeof v === "number" ? v : num((v as any)?.n, 0);
        const chot = typeof v === "number" ? 0 : num((v as any)?.chot, 0);
        const o = (out[k] ??= { calls: 0, chot: 0 }); o.calls += calls; o.chot += chot;
      }
    }
  } catch { }
  return out;
}

async function monthAggregate(sb: any, month: string, excluded: Set<string>): Promise<{ channels: ChannelRow[]; totalOrders: number; totalCustomers: number; totalRevenue: number }> {
  const [from, to] = monthRange(month);
  const { rows: li } = await layDoanhThu(sb, from, to);
  const map: Record<string, { revenue: number; orders: Set<string> }> = {};
  const orders = new Set<string>(), custs = new Set<string>(); let rev = 0;
  for (const r of li) {
    if (excluded.has(r.order_code)) continue;
    const ch = (r.sale_channel || "Chưa phân loại").trim() || "Chưa phân loại";
    const o = (map[ch] ??= { revenue: 0, orders: new Set() });
    o.revenue += r.net_amount || 0; o.orders.add(r.order_code);
    orders.add(r.order_code); if (r.customer_phone) custs.add(r.customer_phone); rev += r.net_amount || 0;
  }
  const totalRev = rev || 1;
  const channels = Object.entries(map)
    .map(([channel, v]) => ({ channel, revenue: v.revenue, orders: v.orders.size, pctRev: Math.round(v.revenue / totalRev * 100) }))
    .sort((a, b) => b.revenue - a.revenue);
  return { channels, totalOrders: orders.size, totalCustomers: custs.size, totalRevenue: rev };
}

export async function productMargins(sb: any): Promise<ProductMargin[]> {
  const { data } = await sb.from("products").select("name,category,unit_price,cost_price,active").eq("active", true);
  const rows: ProductMargin[] = [];
  for (const p of data || []) {
    const price = num(p.unit_price, 0), cost = num(p.cost_price, 0);
    if (price <= 0) continue;
    const margin = (price - cost) / price;
    const line = /nova|healing|detox|c[àa] ph[êe]/i.test(p.name || "") ? "nova" : /kho[áa]|course|ndv/i.test(`${p.name} ${p.category}`) ? "course" : "vegan";
    rows.push({ name: p.name || "", price, margin, line });
  }

  return rows.sort((a, b) => b.margin - a.margin).map(r => ({ ...r, margin: Math.round(r.margin * 100) / 100 }));
}

function buildReco(needGap: number, needOrders: number, aovNet: number, margins: ProductMargin[]): Recommendations {
  const topMargin = margins.slice(0, 5);

  const combo = DEFAULT_COMBOS[0];
  const upsell = needGap > 0 && combo ? {
    combo: combo.name, price: combo.listPrice,
    unitsNeeded: Math.ceil(needGap / combo.listPrice),
    addRevenue: Math.ceil(needGap / combo.listPrice) * combo.listPrice,
  } : null;

  const addon = margins.filter(m => m.price > 0 && m.price <= 400_000).sort((a, b) => b.margin - a.margin)[0];
  const crossSell = addon && needOrders > 0 ? {
    product: addon.name, price: addon.price, marginPct: Math.round(addon.margin * 100),
    attachTo: needOrders, addRevenue: needOrders * addon.price,
  } : null;

  const cheapest = DEFAULT_COMBOS.slice().sort((a, b) => a.listPrice - b.listPrice)[0];
  const downsell = cheapest ? { combo: cheapest.name, price: cheapest.listPrice, note: "Chào khách phân vân / ngân sách thấp để không mất đơn" } : null;

  let gift: Recommendations["gift"] = null;
  try {
    const plan = planCombos(Math.max(needGap, 1), DEFAULT_COMBOS);
    gift = { savingsVsDiscount10: Math.round(plan.rows.reduce((s, r) => s + r.vsDiscount10, 0)), totalGiftCost: Math.round(plan.totalGiftCost) };
  } catch { }
  return { gap: needGap, upsell, crossSell, downsell, gift, topMargin };
}

export async function computeRevenueLoop(month: string): Promise<RevenueLoopData> {
  const sb = getServiceClient();
  const prevMonth = prevMonthOf(month);
  const assumptions = await getLoopAssumptions();
  const { closeRate, ordersPerCustomer, grossMargin, desiredMargin, mktCostCapPct, workDaysPerMonth, weeksPerMonth } = assumptions;

  const [metricsThis, metricsPrev, closeReal, ov, margins] = await Promise.all([
    getAllSaleMetrics(month), getAllSaleMetrics(prevMonth), realCloseRates(month), loadOrderOverrides(sb), productMargins(sb),
  ]);
  const aggThis = await monthAggregate(sb, month, ov.excluded);

  const leadsData = await loadLeads(month);
  aggThis.channels = aggThis.channels.map((c) => {
    const leads = leadsData.byChannel[normCh(c.channel)];
    const convRate = leads && leads > 0 ? Math.round((c.orders / leads) * 1000) / 10 : null;
    return { ...c, leads, convRate };
  });

  const prevByName: Record<string, SaleMetric> = {};
  for (const m of metricsPrev) prevByName[norm(m.name)] = m;

  const monthActual = metricsThis.reduce((s, m) => s + m.revenue, 0);
  const totalOrders = aggThis.totalOrders;
  const totalCustomers = aggThis.totalCustomers;
  const teamAov = totalOrders > 0 ? monthActual / totalOrders : 0;

  const annualTarget = await getConfigNumber(CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026);
  const monthActualMap: Record<string, number> = {};
  try { const mr = JSON.parse((await getConfigValue("sum_monthly_revenue")) || "{}"); for (const m in mr) monthActualMap[m] = mr[m].rev || 0; } catch { }
  const targetOverrides = await loadMonthlyTargetOverrides();
  const { rows } = buildMonthlyTargets2026(annualTarget, { ...monthActualMap, [month]: monthActual }, month, targetOverrides);
  const monthTarget = rows.find(r => r.month === month)?.target || 0;

  const quarters = buildQuarterTargets(rows);
  const curQ = quarterOf(month);
  const qRow = quarters.find(q => q.q === curQ);
  const quarter = { q: curQ, label: `Quý ${curQ}`, target: qRow?.target || 0, actual: qRow?.actual || 0, pct: qRow?.pct ?? null };

  const totalDays = monthRange(month)[2];
  const daysElapsed = isCur(month) ? +new Date(Date.now() + 7 * 3600e3).toISOString().slice(8, 10) : totalDays;
  const pace = calcPace(monthActual, daysElapsed, totalDays, monthTarget);
  const expectedPct = Math.round(daysElapsed / totalDays * 100);
  const pacePct = Math.round(pace.pacePercent);
  const projectedPct = Math.round(pace.projectedPercent);
  const finLight: Light = pacePct >= expectedPct - 5 ? "green" : pacePct >= expectedPct - 15 ? "yellow" : "red";

  const opcReal = totalCustomers > 0 ? Math.round(totalOrders / totalCustomers * 100) / 100 : null;
  let totCalls = 0, totChot = 0;
  for (const v of Object.values(closeReal)) { totCalls += v.calls; totChot += v.chot; }
  const closeRateRealTeam = totCalls >= 20 ? clamp01(totChot / totCalls) : null;
  const opcUsed = opcReal && opcReal > 0 ? opcReal : ordersPerCustomer;

  const sales: LoopSaleRow[] = metricsThis
    .filter(m => m.target > 0 || m.revenue > 0)
    .map(m => {
      const key = norm(m.name);
      const aov = m.orders > 0 ? Math.round(m.revenue / m.orders) : Math.round(teamAov);
      const prev = prevByName[key];
      const revLast = prev?.revenue || 0, custsLast = prev?.custs || 0, ordersLast = prev?.orders || 0;
      const aovLast = ordersLast > 0 ? Math.round(revLast / ordersLast) : 0;
      const cr = closeReal[key];
      const closeRateReal = cr && cr.calls >= 20 && cr.chot > 0 ? clamp01(cr.chot / cr.calls) : null;
      const closeRateUsed = closeRateReal ?? closeRate;
      const gap = Math.max(0, m.target - m.revenue);
      const casc = decomposeTarget({ monthTarget: gap, aov: aov || teamAov || 1, ordersPerCustomer: opcUsed, closeRate: closeRateUsed, workDaysPerMonth, weeksPerMonth });
      const behind = m.pct != null && m.pct < expectedPct - 10;
      return {
        userId: m.userId, name: m.name, position: m.position, rank: m.rank,
        target: m.target, revenue: m.revenue, pct: m.pct, orders: m.orders, custs: m.custs, aov,
        revLast, custsLast, ordersLast, aovLast, gap,
        ordersNeeded: Math.ceil(casc.ordersMonth), customersNeeded: Math.ceil(casc.customersMonth), leadsNeeded: Math.ceil(casc.leadsMonth),
        closeRateUsed, closeRateReal, chatScore: m.chatScore, behind,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const needGap = sales.reduce((s, r) => s + r.gap, 0);
  const needOrders = sales.reduce((s, r) => s + r.ordersNeeded, 0);
  const needCustomers = sales.reduce((s, r) => s + r.customersNeeded, 0);
  const needLeads = sales.reduce((s, r) => s + r.leadsNeeded, 0);

  const aovNet = Math.round(teamAov || 0);
  const ceil = adCeilings(aovNet, grossMargin, desiredMargin, closeRate);
  const budgetNeeded = Math.round(needLeads * ceil.cplCeiling);
  const budgetBreakeven = Math.round(needLeads * ceil.cplBreakeven);

  const mktSpend = await getConfigNumber(mktSpendKey(month), 0);
  const mktPct = monthActual > 0 && mktSpend > 0 ? Math.round(mktSpend / monthActual * 1000) / 10 : (mktSpend > 0 ? null : 0);
  const mktCapAmount = Math.round(mktCostCapPct * monthTarget);
  const mktHeadroom = Math.round(mktCapAmount - mktSpend);
  const capPctNum = mktCostCapPct * 100;
  const mktLight: Light = mktPct == null ? "yellow" : mktPct <= capPctNum - 3 ? "green" : mktPct <= capPctNum ? "yellow" : "red";
  const mktOverBudgetWarn = mktSpend + budgetNeeded > mktCapAmount && mktCapAmount > 0;

  const chatVals = sales.map(s => s.chatScore).filter((x): x is number => x != null);
  const chatAvg = chatVals.length ? Math.round(chatVals.reduce((s, x) => s + x, 0) / chatVals.length * 10) / 10 : null;
  const callCloseReal = closeRateRealTeam != null ? Math.round(closeRateRealTeam * 1000) / 10 : null;

  const reco = buildReco(needGap, needOrders, aovNet, margins);

  return {
    month, prevMonth, assumptions,
    annualTarget, monthTarget, monthActual, quarter,
    pacePct, expectedPct, projectedPct, finLight, daysElapsed, totalDays,
    sales, teamAov: Math.round(teamAov), totalOrders, totalCustomers,
    needGap, needOrders, needCustomers, needLeads,
    opcReal, closeRateRealTeam,
    ceil, aovNet, budgetNeeded, budgetBreakeven,
    mktSpend, mktPct, mktCapAmount, mktHeadroom, mktLight, mktOverBudgetWarn,
    channels: aggThis.channels, chatAvg, callCloseReal,
    leadsTotal: leadsData.total, leadsSource: leadsData.source,
    reco,
  };
}
