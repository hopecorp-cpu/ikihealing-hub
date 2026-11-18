import { getServiceClient } from "@/lib/supabase-server";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { netOf } from "@/lib/money";
import { computePnl, fetchAll, type PnlSummary } from "./pnl";
import { layTienMat, tienMatThanhChu, tienMatTungTaiKhoan } from "./tien-mat";

const WEEKS_AHEAD = 13;
const GROWTH_CAP = 0.05;
const WEEKS_PER_MONTH = 30.4 / 7;

export type ForecastWeek = {
  week: number;
  revenue: number;
  cogs: number;
  ship: number;
  payroll: number;
  ads: number;
  interest_opex: number;
  net_flow: number;
  cash_balance: number | null;
};

export type Forecast =
  | { ok: false; reason: string; weeks_available: number }
  | {
      ok: true;
      weeks_ahead: number;
      base_weekly_revenue: number;
      weekly_growth_pct: number;
      assumptions: {
        monthly_payroll: number;
        monthly_ads: number;
        monthly_interest: number;
        monthly_opex: number;
        cogs_ratio_pct: number;
        ship_ratio_pct: number;
        cogs_ratio_from_months: string[];
      };
      opening_cash: number | null;

      opening_cash_accounts: Array<{ account: string; amount: number; as_of: string; stale_days: number | null }>;
      opening_cash_source: string;
      opening_cash_stale: boolean;
      opening_cash_text: string;
      runway_week: number | null;
      total_net_flow_13w: number;
      weeks: ForecastWeek[];
      caveats: string[];
    };

function isoParts(dateStr: string): { year: number; week: number } {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - day + 3);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(
    ((thursday.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7
  );
  return { year, week };
}

function isoWeekSunday(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return sunday.toISOString().slice(0, 10);
}

export async function getOpeningCash(): Promise<{
  amount: number | null;
  accounts: Array<{ account: string; amount: number; as_of: string; stale_days: number | null }>;
  source: string;
  stale: boolean;
  text: string;
}> {
  const tm = await layTienMat();
  const source = tm.tong == null ? "chưa có" : tm.taiKhoan.every((t) => t.nguon === "nhập tay") ? "nhập tay" : "sao kê ngân hàng";
  return { amount: tm.tong, accounts: tienMatTungTaiKhoan(tm), source, stale: tm.cuQua7Ngay, text: tienMatThanhChu(tm) };
}

async function weeklyRevenue(): Promise<Array<{ iso: string; net: number; complete: boolean }>> {
  const sb = getServiceClient();

  const rows = (await layDoanhThuNhieuThang(sb, "2025-01-01", new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10))).rows;

  let maxDate = "";
  const byWeek = new Map<string, { year: number; week: number; net: number }>();
  for (const r of rows) {
    const d = (r.order_date || "").slice(0, 10);
    if (d.length !== 10) continue;
    if (d > maxDate) maxDate = d;
    const { year, week } = isoParts(d);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    const b = byWeek.get(key) || { year, week, net: 0 };
    b.net += netOf(r);
    byWeek.set(key, b);
  }
  return [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([iso, v]) => ({
    iso,
    net: v.net,
    complete: isoWeekSunday(v.year, v.week) <= maxDate,
  }));
}

function recurring(summary: PnlSummary) {
  const monthlyAvg = (pick: (p: PnlSummary["pnl"][number]) => number): number => {
    const vals = summary.pnl.map(pick).filter((v) => v > 0);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  const adsMonths = summary.pnl.filter((p) => p.ads > 0);
  const misaMonths = new Set(summary.coverage.sales || []);
  const common = summary.pnl.filter((p) => misaMonths.has(p.month) && p.cogs > 0);
  const rev = common.reduce((s, p) => s + p.revenue, 0);
  const cogs = common.reduce((s, p) => s + p.cogs, 0);

  const shipAmt = summary.pnl.reduce((s, p) => s + p.ship, 0);
  const shipRev = summary.pnl
    .filter((p) => p.ship > 0 && misaMonths.has(p.month))
    .reduce((s, p) => s + p.revenue, 0);
  return {
    monthly_payroll: monthlyAvg((p) => p.payroll),
    monthly_interest: monthlyAvg((p) => p.interest),
    monthly_opex: monthlyAvg((p) => p.opex),
    monthly_ads: adsMonths.length ? adsMonths[adsMonths.length - 1].ads : 0,
    cogs_ratio: rev ? cogs / rev : 0.3,
    cogs_ratio_from: common.map((p) => p.month),
    ship_ratio: shipRev ? shipAmt / shipRev : 0.02,
  };
}

export async function buildForecast(summary?: PnlSummary): Promise<Forecast> {
  const summ = summary ?? (await computePnl());
  const weeks = await weeklyRevenue();
  const complete = weeks.filter((w) => w.complete);

  if (complete.length < 4) {
    return {
      ok: false,
      reason: "Chưa đủ 4 tuần doanh thu trọn vẹn để dự báo tin cậy.",
      weeks_available: complete.length,
    };
  }

  const rec = recurring(summ);
  const weeklyPayroll = rec.monthly_payroll / WEEKS_PER_MONTH;
  const weeklyAds = rec.monthly_ads / WEEKS_PER_MONTH;
  const weeklyFixedOther = (rec.monthly_interest + rec.monthly_opex) / WEEKS_PER_MONTH;

  const nets = complete.map((w) => w.net);
  const recent4 = nets.slice(-4).reduce((s, v) => s + v, 0) / 4;
  const prior4 =
    nets.length >= 8 ? nets.slice(-8, -4).reduce((s, v) => s + v, 0) / 4 : recent4;

  let g = prior4 > 0 ? Math.pow(recent4 / prior4, 0.25) - 1 : 0;
  g = Math.max(-GROWTH_CAP, Math.min(GROWTH_CAP, g));

  const opening = await getOpeningCash();
  const proj: ForecastWeek[] = [];
  let cash: number | null = opening.amount;
  let rev = recent4;
  let runwayWeek: number | null = null;
  for (let i = 1; i <= WEEKS_AHEAD; i++) {
    rev = rev * (1 + g);
    const cogs = rev * rec.cogs_ratio;
    const ship = rev * rec.ship_ratio;
    const flow = rev - cogs - ship - weeklyPayroll - weeklyAds - weeklyFixedOther;
    if (cash != null) {
      cash += flow;
      if (runwayWeek === null && cash < 0) runwayWeek = i;
    }
    proj.push({
      week: i,
      revenue: Math.round(rev),
      cogs: Math.round(cogs),
      ship: Math.round(ship),
      payroll: Math.round(weeklyPayroll),
      ads: Math.round(weeklyAds),
      interest_opex: Math.round(weeklyFixedOther),
      net_flow: Math.round(flow),
      cash_balance: cash == null ? null : Math.round(cash),
    });
  }

  return {
    ok: true,
    weeks_ahead: WEEKS_AHEAD,
    base_weekly_revenue: Math.round(recent4),
    weekly_growth_pct: Math.round(g * 10000) / 100,
    assumptions: {
      monthly_payroll: Math.round(rec.monthly_payroll),
      monthly_ads: Math.round(rec.monthly_ads),
      monthly_interest: Math.round(rec.monthly_interest),
      monthly_opex: Math.round(rec.monthly_opex),
      cogs_ratio_pct: Math.round(rec.cogs_ratio * 1000) / 10,
      ship_ratio_pct: Math.round(rec.ship_ratio * 1000) / 10,
      cogs_ratio_from_months: rec.cogs_ratio_from,
    },
    opening_cash: opening.amount,
    opening_cash_accounts: opening.accounts,
    opening_cash_source: opening.source,
    opening_cash_stale: opening.stale,
    opening_cash_text: opening.text,
    runway_week: runwayWeek,
    total_net_flow_13w: proj.reduce((s, r) => s + r.net_flow, 0),
    weeks: proj,
    caveats: [
      "Dự báo ngoại suy từ doanh thu 4-8 tuần gần nhất, giả định xu hướng tiếp diễn " +
        `(±${Math.round(GROWTH_CAP * 100)}%/tuần tối đa) — KHÔNG lường sự kiện bất ngờ.`,
      "Chi ads/ship đang ghi thiếu nên dòng tiền dự báo LẠC QUAN hơn thực tế.",
      opening.amount == null
        ? "Chưa có số dư tiền mặt (chưa bóc sổ phụ ngân hàng) — dự báo chỉ có dòng tiền, KHÔNG có số dư/runway."
        : opening.text + (opening.stale ? " — số dư đã cũ, số dư dự báo lệch theo." : ""),
    ],
  };
}
