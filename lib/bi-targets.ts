export const ACME_TARGETS = {

  saleIndividualTarget:  100_000_000,
  saleLeaderTarget:      200_000_000,
  groupBonusTrigger:     500_000_000,

  monthlyRevenueTarget:  1_000_000_000,
  monthlyCourseTarget:   200_000_000,
  monthlyProfitTarget:   200_000_000,

  payrollToRevenueMax:   40,
  marginMin:              30,
};

export const DEFAULT_ANNUAL_TARGET_2026 = 10_000_000_000;
export const CONFIG_KEY_ANNUAL_TARGET = "annual_revenue_target_2026";

export const LOCKED_THROUGH_2026 = "2026-05";

const H2_PLAN_WEIGHTS: Record<string, number> = {
  "2026-06": 100, "2026-07": 100, "2026-08": 100, "2026-09": 100,
  "2026-10": 100, "2026-11": 100, "2026-12": 100,
};
const H2_WEIGHT_TOTAL = Object.values(H2_PLAN_WEIGHTS).reduce((a, b) => a + b, 0);

const MONTH_NOTES_2026: Record<string, string> = {
  "2026-02": "Ghi chú mẫu", "2026-12": "Ghi chú mẫu",
};

export type YearTargetRow = {
  month: string; label: string; target: number; actual: number;
  kind: "actual" | "current" | "plan"; note: string;
};

export const MONTHLY_TARGET_OVERRIDES_KEY = "monthly_target_overrides";

export function buildMonthlyTargets2026(
  annualTarget: number,
  monthActual: Record<string, number>,
  curMonth: string,

  overrides?: Record<string, number>,
): { rows: YearTargetRow[]; annualTarget: number; ytdActual: number } {
  const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
  const lockedActual = months.filter(m => m <= LOCKED_THROUGH_2026).reduce((s, m) => s + (monthActual[m] || 0), 0);
  const remaining = Math.max(0, annualTarget - lockedActual);

  const rows: YearTargetRow[] = months.map(m => {
    const isH2 = !!H2_PLAN_WEIGHTS[m];
    const ov = overrides?.[m];
    const target = ov && ov > 0 ? Math.round(ov) : isH2
      ? Math.round(remaining * (H2_PLAN_WEIGHTS[m] / H2_WEIGHT_TOTAL))
      : (monthActual[m] || 0);
    const kind: "actual" | "current" | "plan" = m < curMonth ? "actual" : m === curMonth ? "current" : "plan";
    return {
      month: m, label: "T" + parseInt(m.slice(5), 10), target, actual: monthActual[m] || 0, kind,
      note: ov && ov > 0 ? "Mốc chốt tay" : m <= LOCKED_THROUGH_2026 ? "Thực tế (đã chốt)" : (MONTH_NOTES_2026[m] || "Kế hoạch"),
    };
  });
  const ytdActual = months.filter(m => m <= curMonth).reduce((s, m) => s + (monthActual[m] || 0), 0);
  return { rows, annualTarget, ytdActual };
}

export type QuarterRow = { q: 1 | 2 | 3 | 4; label: string; months: string[]; target: number; actual: number; pct: number | null };

export function buildQuarterTargets(rows: YearTargetRow[]): QuarterRow[] {
  return ([1, 2, 3, 4] as const).map((q) => {
    const ms = rows.filter((r) => Math.ceil(parseInt(r.month.slice(5), 10) / 3) === q);
    const target = ms.reduce((s, r) => s + r.target, 0);
    const actual = ms.reduce((s, r) => s + r.actual, 0);
    return { q, label: `Quý ${q}`, months: ms.map((r) => r.month), target, actual, pct: target > 0 ? Math.round((actual / target) * 1000) / 10 : null };
  });
}

export function quarterOf(month: string): 1 | 2 | 3 | 4 {
  return (Math.ceil(parseInt(month.slice(5), 10) / 3) as 1 | 2 | 3 | 4);
}

export function calcPace(actualSoFar: number, daysElapsed: number, totalDays: number, target: number): {
  pacePercent: number;
  pacePerDay: number;
  projectedEndOfPeriod: number;
  projectedPercent: number;
  delta: number;
  status: "ahead" | "on_track" | "behind" | "at_risk";
  daysToTarget: number | null;
  dailyRateNeeded: number;
} {
  if (daysElapsed === 0) return {
    pacePercent: 0, pacePerDay: 0, projectedEndOfPeriod: 0, projectedPercent: 0,
    delta: -target, status: "at_risk", daysToTarget: null,
    dailyRateNeeded: target / totalDays
  };

  const pacePerDay = actualSoFar / daysElapsed;
  const projectedEndOfPeriod = pacePerDay * totalDays;
  const pacePercent = target > 0 ? (actualSoFar / target) * 100 : 0;
  const projectedPercent = target > 0 ? (projectedEndOfPeriod / target) * 100 : 0;
  const delta = projectedEndOfPeriod - target;
  const daysRemaining = totalDays - daysElapsed;
  const remainingGap = target - actualSoFar;
  const dailyRateNeeded = daysRemaining > 0 ? remainingGap / daysRemaining : 0;
  const daysToTarget = pacePerDay > 0 ? Math.ceil(remainingGap / pacePerDay) : null;

  let status: "ahead" | "on_track" | "behind" | "at_risk";
  if (projectedPercent >= 110) status = "ahead";
  else if (projectedPercent >= 90) status = "on_track";
  else if (projectedPercent >= 70) status = "behind";
  else status = "at_risk";

  return { pacePercent, pacePerDay, projectedEndOfPeriod, projectedPercent, delta, status, daysToTarget, dailyRateNeeded };
}

export function classifyProductLine(product: { name?: string; sku?: string; category?: string }): "san_pham_a" | "NOVA" | "course" | "other" {
  const text = `${product.name || ""} ${product.sku || ""} ${product.category || ""}`.toLowerCase();
  if (/nova|healing|detox/.test(text)) return "NOVA";
  if (/khoá|khoa hoc|course/i.test(text)) return "course";
  if (/vegan|tpcn|trà|bột|viên|combo/i.test(text)) return "san_pham_a";
  return "other";
}

export const PRODUCT_LINE_INFO = {
  san_pham_a:  { label: "Đạm Mẫu",     color: "#10B981", icon: "" },
  NOVA: { label: "NOVA",    color: "#3B82F6", icon: "" },
  course:      { label: "Khoá học mẫu",   color: "#8B5CF6", icon: "" },
  other:       { label: "Khác",            color: "#6B7280", icon: "" }
};

export function fmtDelta(value: number): { text: string; positive: boolean; arrow: string } {
  const abs = Math.abs(value);
  const formatted = abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(1)}M`
                  : abs >= 1_000 ? `${(abs / 1_000).toFixed(0)}K`
                  : abs.toFixed(0);
  return { text: formatted, positive: value >= 0, arrow: value >= 0 ? "▲" : "▼" };
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}
