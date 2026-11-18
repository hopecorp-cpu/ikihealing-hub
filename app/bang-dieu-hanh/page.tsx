import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { FINANCE_WHITELIST, isAdmin } from "@/lib/auth";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026 } from "@/lib/bi-targets";
import { getBankBalances } from "@/lib/bank-balance";
import { vnDateStr } from "@/lib/payroll";
import finance from "@/data/finance-data.json";
import ExecDashboard from "./ExecDashboard";
import BgdSummary from "./BgdSummary";
import Cockpit from "./Cockpit";
import { computeCockpit } from "@/lib/cockpit";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Bảng điều hành | ACME Ops Hub") };
}

const WHITELIST = FINANCE_WHITELIST;

export default async function BangDieuHanhPage({ searchParams }: { searchParams: { m?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const email = (user.email || "").toLowerCase().trim();
  if (!(isAdmin(user.role) || WHITELIST.includes(email))) redirect("/?denied=bangdieuhanh");
  const sb = getServiceClient();
  const month = searchParams.m || vnDateStr().slice(0, 7);

  const docSoGd = async () => {
    let bt: any[] = [], o1 = 0;
    while (true) { const { data } = await sb.from("bank_transactions").select("txn_date,amount,type").range(o1, o1 + 999); if (!data || !data.length) break; bt = bt.concat(data); if (data.length < 1000) break; o1 += 1000; }
    return bt;
  };
  const [annualRaw, monthlyRaw, retentionRaw, bsRaw, bankBal, bt, dtNhieuThang, { count: chatPhones }, cockpit] = await Promise.all([
    getConfigValue(CONFIG_KEY_ANNUAL_TARGET),
    getConfigValue("sum_monthly_revenue"),
    getConfigValue("sum_retention"),
    getConfigValue("balance_sheet"),
    getBankBalances(),
    docSoGd(),
    layDoanhThuNhieuThang(sb, "2026-03-01", vnDateStr()),
    sb.from("salework_chat_analysis").select("customer_name", { count: "exact", head: true }),
    computeCockpit(sb),
  ]);
  const annual = Number(annualRaw) || DEFAULT_ANNUAL_TARGET_2026;
  const pnl: any[] = (finance as any).pnl || [];

  let monthlyRev: Record<string, any> = {};
  try { monthlyRev = JSON.parse(monthlyRaw || "{}"); } catch { }
  const revRows = Object.entries(monthlyRev).map(([m, v]: any) => ({ month: m, label: "T" + parseInt(m.slice(5)), rev: v.rev || 0, orders: v.orders || 0, customers: v.customers || 0 })).sort((a, b) => a.month.localeCompare(b.month));

  let R: any = {}; try { R = JSON.parse(retentionRaw || "{}"); } catch { }

  let bs: Record<string, any> = {}; try { bs = JSON.parse(bsRaw || "{}"); } catch { }

  const { banks, total: cash } = bankBal;
  const netByM: Record<string, number> = {};
  for (const t of bt) { const m = (t.txn_date || "").slice(0, 7); if (!m) continue; const a = Math.abs(t.amount || 0); netByM[m] = (netByM[m] || 0) + (t.type === "credit" ? a : -a); }
  const bankMonths = Object.keys(netByM).filter(m => netByM[m] !== 0).sort();
  const last3 = bankMonths.slice(-3);
  const avgNet = last3.length ? last3.reduce((s, m) => s + netByM[m], 0) / last3.length : 0;
  const runwayMonths = avgNet < 0 && cash > 0 ? cash / Math.abs(avgNet) : null;

  const li = dtNhieuThang.rows;
  const chanMap: Record<string, number> = {}, prodMap: Record<string, number> = {};
  const custSet = new Set<string>();
  for (const r of li) {
    const ch = (r.sale_channel || "Khác").trim(); chanMap[ch] = (chanMap[ch] || 0) + (r.net_amount || 0);
    const pn = (r.product_name || "Khác").trim(); prodMap[pn] = (prodMap[pn] || 0) + (r.net_amount || 0);
    if (r.customer_phone) custSet.add(r.customer_phone);
  }

  const gift = { cost: 0, value: 0, orders: 0, custs: 0 };
  const channelMix = Object.entries(chanMap).map(([name, rev]) => ({ name, rev })).sort((a, b) => b.rev - a.rev);
  const productMix = Object.entries(prodMap).map(([name, rev]) => ({ name, rev })).sort((a, b) => b.rev - a.rev).slice(0, 6);

  const funnel = { tuVan: R.totalCust ? Math.max(R.totalCust, custSet.size) : custSet.size, chot: custSet.size, chatChamSoc: chatPhones || 0 };

  const ratioRows = pnl.map((p: any) => {
    const b = bs[p.month] || {};
    const ros = p.revenue ? p.profit / p.revenue : 0;
    const assets = b.totalAssets || 0, equity = b.equity || 0;
    const assetTurn = assets ? p.revenue / assets : 0;
    const leverage = equity ? assets / equity : 0;
    return { label: p.label?.replace("Tháng ", "T") || p.month, ros: +(ros * 100).toFixed(1), roa: assets ? +(p.profit / assets * 100).toFixed(1) : null, roe: equity ? +(p.profit / equity * 100).toFixed(1) : null, assetTurn: +assetTurn.toFixed(2), leverage: +leverage.toFixed(2), profit: Math.round(p.profit), revenue: Math.round(p.revenue), cost: Math.round(p.total_cost) };
  });

  const ytd = revRows.reduce((s, r) => s + r.rev, 0);
  const monthsWith = revRows.filter(r => r.rev > 0).length || 1;
  const avgMonth = ytd / monthsWith;
  const curMonthIdx = new Date(Date.now() + 7 * 3600e3).getUTCMonth() + 1;
  const monthsLeft = Math.max(0, 12 - curMonthIdx);
  const scenarios = [
    { name: "Bi quan (−10%)", value: ytd + avgMonth * 0.9 * monthsLeft },
    { name: "Cơ sở", value: ytd + avgMonth * monthsLeft },
    { name: "Tích cực (+50% Tết)", value: ytd + avgMonth * 1.5 * monthsLeft },
  ].map(s => ({ ...s, value: Math.round(s.value), pct: Math.round(s.value / annual * 100) }));

  const data = {
    annual, cash, banks, avgNet, runwayMonths,
    revRows, netByM: bankMonths.map(m => ({ label: "T" + parseInt(m.slice(5)), net: Math.round(netByM[m]) })),
    pnlRows: pnl.map((p: any) => ({ label: p.label?.replace("Tháng ", "T") || p.month, revenue: Math.round(p.revenue), cost: Math.round(p.total_cost), profit: Math.round(p.profit), margin: +(p.net_margin * 100).toFixed(1) })),
    ratioRows, retention: R, channelMix, productMix, funnel, scenarios, ytd, gift,
  };

  return (
    <div className="space-y-6">
      <Cockpit c={cockpit} />
      <ExecDashboard data={data} />
      <BgdSummary month={month} />
    </div>
  );
}
