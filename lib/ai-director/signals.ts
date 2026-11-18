const tr = (n: number) => Math.round((Number(n) || 0) / 1e6) + "tr";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DirectorArea = "Doanh thu" | "Sale" | "MKT" | "Kho" | "Tài chính";

export interface DirectorSignal {
  area: DirectorArea;
  title: string;
  detail: string;
  impact: number;
  risk: RiskLevel;
}

export function toSignals(snap: any): DirectorSignal[] {
  const s: DirectorSignal[] = [];
  const l = snap?.loop || {};

  if (typeof l.pacePct === "number" && typeof l.expectedPct === "number") {
    const behindNhip = l.expectedPct - l.pacePct;
    let impact = 40, risk: RiskLevel = "LOW";
    if (behindNhip >= 25) { impact = 92; risk = "CRITICAL"; }
    else if (behindNhip >= 12) { impact = 78; risk = "HIGH"; }
    else if (behindNhip >= 5) { impact = 62; risk = "MEDIUM"; }
    else if (l.pacePct >= l.expectedPct) { impact = 25; risk = "LOW"; }
    s.push({
      area: "Doanh thu",
      title: behindNhip >= 5 ? "Doanh thu chậm nhịp" : "Doanh thu bám nhịp",
      detail: `${tr(l.monthActual)}/${tr(l.monthTarget)} = ${l.pacePct}% KPI (nhịp kỳ vọng ${l.expectedPct}%). Còn thiếu ${tr(l.needGap)}, cần ~${l.needOrders} đơn / ~${l.needLeads} lead.`,
      impact, risk,
    });
  }

  const behind = (l.sales || []).filter((x: any) => x.behind);
  if (behind.length) {
    const impact = Math.min(90, 45 + behind.length * 12);
    s.push({
      area: "Sale",
      title: `${behind.length} sale tụt nhịp KPI`,
      detail: behind.map((x: any) => `${x.name} ${x.pct ?? "?"}%`).join(", "),
      impact, risk: impact >= 80 ? "HIGH" : "MEDIUM",
    });
  }

  if (l.mktOverBudgetWarn || l.mktLight === "red" || l.mktLight === "yellow") {
    const over = !!l.mktOverBudgetWarn;
    s.push({
      area: "MKT",
      title: over ? "Chi phí MKT VƯỢT TRẦN" : "Chi phí MKT sát trần",
      detail: `${l.mktPct ?? "?"}% doanh thu (chi ${tr(l.mktSpend)}, trần ${Math.round((l.mktCapAmount || 0) / 1e6)}tr).`,
      impact: over ? 85 : 60, risk: over ? "HIGH" : "MEDIUM",
    });
  }

  const out = snap?.stock?.out || [], low = snap?.stock?.low || [];
  if (out.length || low.length) {
    const impact = out.length >= 3 ? 80 : out.length ? 65 : 50;
    s.push({
      area: "Kho",
      title: out.length ? `${out.length} mã HẾT hàng` : `${low.length} mã sắp hết`,
      detail: `Hết(0): ${out.slice(0, 10).join(", ") || "không"}. Sắp hết: ${low.slice(0, 10).join(", ") || "không"}.`,
      impact, risk: out.length >= 3 ? "HIGH" : out.length ? "MEDIUM" : "LOW",
    });
  }

  const loans = snap?.loans || [];
  if (loans.length) {
    const overdue = loans.some((x: string) => x.includes("QUÁ HẠN"));
    s.push({
      area: "Tài chính",
      title: overdue ? "Có kỳ lãi vay QUÁ HẠN" : `${loans.length} kỳ lãi vay trong 30 ngày`,
      detail: loans.join(" | "),
      impact: overdue ? 90 : 60, risk: overdue ? "CRITICAL" : "MEDIUM",
    });
  }

  const ls = snap?.leadsSla;
  if (ls && (ls.overSla > 0 || (ls.slow || []).length)) {
    const impact = ls.overSla >= 5 || (ls.slow || []).length >= 2 ? 72 : 55;
    s.push({
      area: "Sale",
      title: "Phản hồi lead chậm",
      detail: `${ls.overSla} lead quá ${ls.sla}' chưa liên hệ; sale chậm chăm: ${(ls.slow || []).join(", ") || "—"}.`,
      impact, risk: impact >= 70 ? "HIGH" : "MEDIUM",
    });
  }

  const red = snap?.strategy?.red || [];
  if (red.length) {
    s.push({
      area: "Doanh thu",
      title: `${red.length} mục tiêu chiến lược chưa đạt`,
      detail: red.join("; "),
      impact: Math.min(75, 40 + red.length * 10), risk: red.length >= 3 ? "HIGH" : "MEDIUM",
    });
  }

  return s.sort((a, b) => priority(b) - priority(a));
}

const RISK_MULT: Record<RiskLevel, number> = { CRITICAL: 2.0, HIGH: 1.5, MEDIUM: 1.0, LOW: 0.8 };
const priority = (s: DirectorSignal) => s.impact * RISK_MULT[s.risk];

export function prioritizedDigest(signals: DirectorSignal[], topN = 8): string {
  if (!signals.length) return "Không phát hiện tín hiệu bất thường theo luật số.";
  return signals.slice(0, topN)
    .map((s, i) => `${i + 1}. [${s.area} · impact ${s.impact} · risk ${s.risk}] ${s.title} — ${s.detail}`)
    .join("\n");
}

const SEV: Record<RiskLevel, "cao" | "vừa" | "thấp"> = { CRITICAL: "cao", HIGH: "cao", MEDIUM: "vừa", LOW: "thấp" };

export function heuristicAnalysis(month: string, snap: any) {
  const signals = toSignals(snap);
  const l = snap?.loop || {};
  const hi = signals.filter((s) => s.risk === "HIGH" || s.risk === "CRITICAL");
  const crit = signals.filter((s) => s.risk === "CRITICAL");

  const health: "green" | "yellow" | "red" = crit.length ? "red" : hi.length ? "yellow" : "green";

  const summary = `Phân tích nhanh (không dùng AI) ${signals.length} tín hiệu. `
    + (crit.length ? `${crit.length} tín hiệu rủi ro cao. ` : hi.length ? `${hi.length} điểm cần chú ý. ` : "Tình hình ổn định. ")
    + (signals[0] ? `Ưu tiên: ${signals[0].title}.` : "");

  const risks = hi.slice(0, 4).map((s) => ({ area: s.area, issue: `${s.title} — ${s.detail}`, severity: SEV[s.risk] }));

  const actions = hi.slice(0, 5).map((s) => ({
    area: s.area,
    who: s.area === "Sale" ? "Trưởng sale" : s.area === "MKT" ? "MKT" : s.area === "Kho" ? "Kho/Mua hàng" : s.area === "Tài chính" ? "Kế toán" : "BGĐ",
    task: `Xử lý: ${s.title} (${s.detail.slice(0, 80)})`,
    impact: s.risk === "CRITICAL" ? "Ngăn thiệt hại lớn" : "Kéo lại nhịp",
  }));

  const opportunities: string[] = [];
  const top = (l.reco?.topMargin || []).slice(0, 3).map((p: any) => p.name);
  if (top.length) opportunities.push(`Đẩy SP biên cao: ${top.join(", ")}.`);
  if (l.reco?.upsell?.combo) opportunities.push(`Upsell combo "${l.reco.upsell.combo}" (+${tr(l.reco.upsell.addRevenue)}).`);
  if (l.reco?.gift?.savingsVsDiscount10) opportunities.push(`Tặng quà thay chiết khấu — lợi hơn ${tr(l.reco.gift.savingsVsDiscount10)} so với giảm 10%.`);
  if (!opportunities.length) opportunities.push("Chưa có cơ hội nổi bật theo luật số.");

  return { health, summary, risks, actions, opportunities, signals, generatedAt: new Date().toISOString(), month, fallback: true };
}
