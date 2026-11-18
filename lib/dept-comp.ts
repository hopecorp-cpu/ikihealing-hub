export function bandFactor(completionPct: number): { factor: number; label: string } {
  const c = Math.min(Math.max(completionPct, 0), 150);
  if (c < 70) return { factor: 0, label: "<70% → 0 thưởng" };
  if (c < 90) return { factor: 0.5, label: "70–89% → ½ thưởng" };
  if (c < 100) return { factor: 0.75, label: "90–99% → ¾ thưởng" };
  return { factor: 1, label: "≥100% → thưởng đủ" };
}

export function isLowerBetter(title: string | null | undefined): boolean {
  return /hoàn|lỗi|sai|khiếu nại|phạt|cpo|cpl|chi phí|thoát|churn|rời|trễ|chậm|tồn đọng/i.test(title || "");
}

export type KpiRow = {
  title?: string | null;
  metric_unit?: string | null;
  target_value: number | null;
  current_value: number | null;
  weight_percent: number | null;
  is_lower_better?: boolean | null;
};

export function kpiLowerBetter(k: KpiRow): boolean {
  return k.is_lower_better != null ? !!k.is_lower_better : isLowerBetter(k.title);
}

export function isMeasured(k: KpiRow): boolean {
  return k.current_value != null && Number(k.current_value) !== 0;
}

export function kpiCompletion(k: KpiRow): number {
  const target = Number(k.target_value) || 0;
  const cur = Number(k.current_value) || 0;
  if (target <= 0 || cur <= 0) return 0;
  const pct = kpiLowerBetter(k) ? (target / cur) * 100 : (cur / target) * 100;
  return Math.min(Math.max(pct, 0), 150);
}

export function weightedCompletion(kpis: KpiRow[]): number {
  const rows = kpis.filter(k => (Number(k.weight_percent) || 0) > 0 && (Number(k.target_value) || 0) > 0 && isMeasured(k));
  const totalW = rows.reduce((s, k) => s + (Number(k.weight_percent) || 0), 0);
  if (totalW <= 0) return 0;
  const sum = rows.reduce((s, k) => s + kpiCompletion(k) * (Number(k.weight_percent) || 0), 0);
  return sum / totalW;
}

export type DeptBonusResult = {
  completion: number;
  factor: number;
  bonus: number;
  bandLabel: string;
  explanation: string;
  kpiCount: number;
};

export function calcDeptKpiBonus(maxBonus: number, kpis: KpiRow[]): DeptBonusResult {
  const assigned = kpis.filter(k => (Number(k.weight_percent) || 0) > 0 && (Number(k.target_value) || 0) > 0);
  const measured = assigned.filter(isMeasured);
  if (assigned.length === 0) return { completion: 0, factor: 0, bonus: 0, bandLabel: "—", explanation: "Chưa gán KPI có trọng số", kpiCount: 0 };
  if (!maxBonus || maxBonus <= 0) return { completion: 0, factor: 0, bonus: 0, bandLabel: "—", explanation: "Chưa có quỹ thưởng (max_bonus)", kpiCount: assigned.length };
  if (measured.length === 0) return { completion: 0, factor: 0, bonus: 0, bandLabel: "chưa nhập số đo", explanation: `Đã gán ${assigned.length} KPI nhưng chưa nhập số đo → chưa tính thưởng`, kpiCount: assigned.length };
  const completion = weightedCompletion(measured);
  const { factor, label } = bandFactor(completion);
  const bonus = Math.round(maxBonus * factor);
  const partial = measured.length < assigned.length ? ` (mới đo ${measured.length}/${assigned.length} KPI)` : "";
  return {
    completion: Math.round(completion),
    factor, bonus, bandLabel: label, kpiCount: assigned.length,
    explanation: `KPI ${Math.round(completion)}% (${label})${partial} → ${bonus.toLocaleString("vi-VN")}đ / quỹ ${maxBonus.toLocaleString("vi-VN")}đ`,
  };
}

export const CHUYEN_CAN_DEFAULT = 300_000;
export const LATE_GRACE_COUNT = 2;
export const LATE_BIG_MINUTES = 15;

export type ChuyenCanInput = {
  amount?: number;
  lateDays: number;
  bigLateDays: number;
  unpaidLeaveDays: number;
};

export function calcChuyenCan(i: ChuyenCanInput): { amount: number; reason: string } {
  const base = i.amount ?? CHUYEN_CAN_DEFAULT;
  if (i.unpaidLeaveDays > 0) return { amount: 0, reason: `Có ${i.unpaidLeaveDays} ngày nghỉ không lương → mất chuyên cần` };
  if (i.bigLateDays > 0) return { amount: 0, reason: `${i.bigLateDays} lần muộn ≥${LATE_BIG_MINUTES}' → mất chuyên cần` };
  if (i.lateDays > LATE_GRACE_COUNT) return { amount: 0, reason: `${i.lateDays} lần muộn (> ${LATE_GRACE_COUNT}) → mất chuyên cần` };
  return { amount: base, reason: i.lateDays > 0 ? `Đủ chuyên cần (${i.lateDays} lần muộn nhẹ trong ngưỡng)` : "Đủ chuyên cần (đi làm đầy đủ, đúng giờ)" };
}

export const DEPT_COMP_RATIO: Record<string, { fixed: number; variable: number }> = {
  "Kho & Hỗ Trợ": { fixed: 90, variable: 10 },
  "Tài Chính": { fixed: 90, variable: 10 },
  "Marketing": { fixed: 75, variable: 25 },
  "Chăm Sóc Khách Hàng": { fixed: 80, variable: 20 },
  "Kinh Doanh & Sale": { fixed: 60, variable: 40 },
  "Ban Điều Hành": { fixed: 100, variable: 0 },
  "Pháp Lý": { fixed: 90, variable: 10 },
};

export type KpiTemplate = { title: string; metric_unit: string; target_value: number; weight_percent: number; note?: string; isLowerBetter?: boolean };

export const DEPT_KPI_TEMPLATES: Record<string, KpiTemplate[]> = {
  "MKT — Trưởng phòng / Lead": [
    { title: "Doanh thu do MKT tạo ra (attributed)", metric_unit: "VNĐ", target_value: 300_000_000, weight_percent: 40 },
    { title: "Hiệu quả chi phí quảng cáo đạt chuẩn (%)", metric_unit: "%", target_value: 100, weight_percent: 30, note: "% chiến dịch giữ được ngân sách/đơn trong ngưỡng" },
    { title: "% đạt target công ty tháng", metric_unit: "%", target_value: 100, weight_percent: 30 },
  ],
  "MKT — Content / Creative": [
    { title: "Số bài đăng đúng hạn", metric_unit: "bài", target_value: 20, weight_percent: 30, note: "Sản lượng = điều kiện cần" },
    { title: "Reach / Engagement rate", metric_unit: "%", target_value: 5, weight_percent: 40 },
    { title: "Lead do content tạo (attributed)", metric_unit: "lead", target_value: 100, weight_percent: 30 },
  ],
  "MKT — Chạy Ads / Performance": [
    { title: "Hiệu quả chi phí quảng cáo đạt chuẩn (%)", metric_unit: "%", target_value: 100, weight_percent: 50, note: "% ngày/chiến dịch giữ CPO trong ngưỡng. KHÔNG thưởng % tiết kiệm ngân sách" },
    { title: "Volume lead đạt", metric_unit: "lead", target_value: 300, weight_percent: 30 },
    { title: "Lãi gộp trên mỗi đơn (VNĐ)", metric_unit: "VNĐ", target_value: 800_000, weight_percent: 20 },
  ],
  "Kho & Vận hành": [
    { title: "Tỉ lệ đóng gói sai", metric_unit: "%", target_value: 1, weight_percent: 40, isLowerBetter: true, note: "CỔNG chất lượng: <1% mới xét thưởng (thấp tốt hơn)" },
    { title: "Năng suất đơn xử lý / ngày", metric_unit: "đơn", target_value: 50, weight_percent: 30 },
    { title: "Độ chính xác tồn kho so MISA", metric_unit: "%", target_value: 99, weight_percent: 30 },
  ],
  "Tài chính — Kế toán": [
    { title: "Đóng sổ / báo cáo đúng hạn", metric_unit: "%", target_value: 100, weight_percent: 40 },
    { title: "Độ chính xác báo cáo thuế (%)", metric_unit: "%", target_value: 100, weight_percent: 30, note: "% kỳ không sai sót/không bị truy thu" },
    { title: "Đối chiếu ngân hàng khớp", metric_unit: "%", target_value: 100, weight_percent: 30 },
  ],
  "CSKH": [
    { title: "Tỉ lệ trả lời trong SLA", metric_unit: "%", target_value: 95, weight_percent: 30 },
    { title: "Điểm hài lòng (CSAT)", metric_unit: "điểm", target_value: 9, weight_percent: 30 },
    { title: "Tỉ lệ giữ chân / tái mua", metric_unit: "%", target_value: 30, weight_percent: 40 },
  ],
};

export const fmtCompVND = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
