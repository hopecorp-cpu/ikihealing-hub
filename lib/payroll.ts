export const WORK_HOURS = {
  morningStart: "08:00",
  morningEnd: "12:00",
  afternoonStart: "13:30",
  afternoonEnd: "17:30",
  hoursPerDay: 8,
  graceMinutes: 5
};

export const OFFICE_LOCATION = {
  lat: 20.9401072,
  lng: 106.3337713,
  radiusMeters: 400,
  accuracyTolerance: 300,
  name: "Văn phòng 40A Quang Trung",
  address: "Số 1 Đường Mẫu, Phường Mẫu, Thành phố Mẫu",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=20.9401072,106.3337713",
};
export type OfficeLocation = typeof OFFICE_LOCATION;
const VP_MAC_DINH: OfficeLocation = OFFICE_LOCATION;

export function vanPhongCua(_email?: string | null): OfficeLocation {
  return OFFICE_LOCATION;
}

export function gpsDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function isInsideOffice(
  lat: number | null | undefined,
  lng: number | null | undefined,
  accuracy?: number | null,
  OFFICE_LOCATION: OfficeLocation = VP_MAC_DINH
): {
  ok: boolean; distance: number | null; message: string;
} {
  if (lat == null || lng == null) {
    return { ok: false, distance: null, message: "Không lấy được GPS — vui lòng cấp quyền vị trí" };
  }
  const d = gpsDistanceMeters(lat, lng, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);

  const tolerance = Math.min(Math.max(accuracy ?? 0, 0) / 2, OFFICE_LOCATION.accuracyTolerance);
  const effectiveRadius = OFFICE_LOCATION.radiusMeters + tolerance;
  if (d <= effectiveRadius) {
    return { ok: true, distance: d, message: `✓ Tại ${OFFICE_LOCATION.name} (cách ${d}m)` };
  }
  const km = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d}m`;
  return {
    ok: false,
    distance: d,
    message: `Bạn cách văn phòng ${km} — không thể chấm công. Vui lòng đến ${OFFICE_LOCATION.name} (bán kính ${OFFICE_LOCATION.radiusMeters}m)`
  };
}

export type WorkMode = "office" | "remote" | "hybrid";

export function validateCheckInLocation(
  workMode: WorkMode | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
  accuracy?: number | null,
  OFFICE_LOCATION: OfficeLocation = VP_MAC_DINH
): {
  ok: boolean;
  workLocation: "office" | "remote";
  distance: number | null;
  message: string;
} {
  const mode = workMode ?? "office";

  if (mode === "remote") {
    if (lat == null || lng == null) {
      return { ok: true, workLocation: "remote", distance: null, message: "✓ Chấm công remote (không có GPS — đã ghi nhận)" };
    }
    const d = gpsDistanceMeters(lat, lng, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    return { ok: true, workLocation: "remote", distance: d, message: `✓ Chấm công remote — cách văn phòng ${d >= 1000 ? `${(d/1000).toFixed(1)} km` : `${d}m`}` };
  }

  if (mode === "hybrid") {
    if (lat == null || lng == null) {
      return { ok: true, workLocation: "remote", distance: null, message: "✓ Chấm công hybrid (không có GPS — đánh dấu remote)" };
    }
    const d = gpsDistanceMeters(lat, lng, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    const tolerance = Math.min(Math.max(accuracy ?? 0, 0) / 2, OFFICE_LOCATION.accuracyTolerance);
    const isOffice = d <= OFFICE_LOCATION.radiusMeters + tolerance;
    return {
      ok: true,
      workLocation: isOffice ? "office" : "remote",
      distance: d,
      message: isOffice ? `✓ Tại văn phòng (cách ${d}m)` : `✓ Chấm công hybrid/remote (cách văn phòng ${d >= 1000 ? `${(d/1000).toFixed(1)} km` : `${d}m`})`
    };
  }

  const result = isInsideOffice(lat, lng, accuracy, OFFICE_LOCATION);
  return {
    ok: result.ok,
    workLocation: "office",
    distance: result.distance,
    message: result.message
  };
}

export const LAW_2026 = {
  bhxhCapBase: 46_800_000,
  bhxhEmployeeRate: 0.105,
  bhxhEmployerRate: 0.215,
  personalDeduction: 15_500_000,
  dependentDeduction: 6_200_000,
  vatSanPhamA: 0.08,
  trialDiscount: 0.85,
  workDaysStandard: 26,
  attendanceBonusTrucPage: 300_000
};

export const LIVESTREAM = { solo: 300_000, group: 200_000 };
export function livestreamAmount(headcount: number): number {
  return headcount >= 2 ? LIVESTREAM.group : LIVESTREAM.solo;
}

export function calcTax(taxable: number): number {
  if (taxable <= 0) return 0;
  if (taxable <= 10_000_000) return Math.round(taxable * 0.05);
  if (taxable <= 30_000_000) return Math.round(taxable * 0.10 - 500_000);
  if (taxable <= 60_000_000) return Math.round(taxable * 0.20 - 3_500_000);
  if (taxable <= 100_000_000) return Math.round(taxable * 0.30 - 9_500_000);
  return Math.round(taxable * 0.35 - 14_500_000);
}

export function calcInsurance(insuranceSalary: number, isCTV: boolean) {
  if (isCTV) return { employee: 0, employer: 0, base: 0 };
  const base = Math.min(insuranceSalary, LAW_2026.bhxhCapBase);
  return {
    employee: Math.round(base * LAW_2026.bhxhEmployeeRate),
    employer: Math.round(base * LAW_2026.bhxhEmployerRate),
    base
  };
}

export function calcWorkdaySalary(grossSalary: number, ncActual: number, ncStandard: number, isTrialPeriod: boolean) {
  const factor = isTrialPeriod ? LAW_2026.trialDiscount : 1.0;
  return Math.round(grossSalary * Math.min(ncActual, ncStandard) / ncStandard * factor);
}

export type SaleType = "leader_sale" | "sale" | "truc_page" | "none";

export function detectSaleType(position: string | null): SaleType {
  if (!position) return "none";
  if (/Leader Sale|Team Lead Sale/i.test(position)) return "leader_sale";
  if (/Trực Page/i.test(position)) return "truc_page";
  if (/Sale/i.test(position)) return "sale";
  return "none";
}

export function calcTierCommission(dsGrossWithVAT: number, target: number): number {
  const dsNet = dsGrossWithVAT / (1 + LAW_2026.vatSanPhamA);
  if (dsNet < target) return 0;
  if (dsNet === target) return Math.round(dsNet * 0.03);
  if (dsNet < target * 2) return Math.round(target * 0.03 + (dsNet - target) * 0.05);

  return Math.round(target * 0.03 + target * 0.05 + (dsNet - target * 2) * 0.06);
}

export function calcLeaderSaleBonus(dsGross: number) {
  return calcTierCommission(dsGross, 150_000_000);
}

export function calcSaleBonus(dsGross: number) {

  return calcTierCommission(dsGross, 150_000_000);
}

export function calcTrucPageBonus(dsGross: number, includeAttendanceBonus = true): number {
  const dsNet = dsGross / (1 + LAW_2026.vatSanPhamA);
  const commission = Math.round(dsNet * 0.015);
  return commission + (includeAttendanceBonus ? LAW_2026.attendanceBonusTrucPage : 0);
}

export function calcGroupBonus(totalGroupDsGross: number, threshold = 300_000_000): number {
  const totalNet = totalGroupDsGross / (1 + LAW_2026.vatSanPhamA);
  if (totalNet < threshold) return 0;
  return Math.round(totalNet * 0.01 + 2_500_000);
}

export const SALE_KPI_TARGET_NET = 150_000_000;

export function saleKpiTarget(position: string | null | undefined): number {
  return /leader|team ?lead/i.test(position || "") ? 150_000_000 : 100_000_000;
}
export function calcSaleCommissionNet(dsNet: number, target = SALE_KPI_TARGET_NET, dsBan?: number): number {
  if ((dsBan ?? dsNet) < target) return 0;
  if (dsNet < target) return Math.round(dsNet * 0.03);
  if (dsNet < target * 2) return Math.round(target * 0.03 + (dsNet - target) * 0.05);
  return Math.round(target * 0.03 + target * 0.05 + (dsNet - target * 2) * 0.06);
}

export function explainSaleCommission(dsNet: number, target = SALE_KPI_TARGET_NET, dsBan?: number): {
  pct: string; formula: string; commission: number; kpiPct: number;
} {
  const kpiPct = Math.round((dsNet / target) * 100);
  const c = calcSaleCommissionNet(dsNet, target, dsBan);
  const T = `${Math.round(target / 1e6)}tr`;
  if (dsBan != null && dsBan >= target && dsNet < target) return { pct: "3%", formula: `Doanh số bán ${dsBan.toLocaleString("vi-VN")} đạt KPI ${T} → 3% × NET ${dsNet.toLocaleString("vi-VN")}`, commission: c, kpiPct };
  if ((dsBan ?? dsNet) < target) return { pct: "0%", formula: `Chưa đạt KPI ${Math.round(target / 1e6)}tr → chưa có hoa hồng (CEO chốt 04/09/2026: không đủ KPI thì không thưởng)`, commission: c, kpiPct };
  if (dsNet < target * 2) return { pct: "3% + 5%", formula: `${T} × 3% + ${((dsNet - target)).toLocaleString("vi-VN")} × 5%`, commission: c, kpiPct };
  return { pct: "3% + 5% + 6%", formula: `${T}×3% + ${T}×5% + ${((dsNet - target * 2)).toLocaleString("vi-VN")} × 6%`, commission: c, kpiPct };
}

export const SALE_GROUP_TARGET_NET = 500_000_000;
export function calcSaleGroupBonusNet(groupDsNet: number, threshold = SALE_GROUP_TARGET_NET): number {
  if (groupDsNet <= threshold) return 0;
  return Math.round((groupDsNet - threshold) * 0.01);
}

export function calcManagerBonusNet(subordinatesDsNet: number): number {
  return Math.round(subordinatesDsNet * 0.01);
}

export function calcGeneralBonus(maxBonus: number, kpis: { weight: number; completion: number }[], rules: { min: number; max: number; mult: number }[]) {
  const total = kpis.reduce((s, k) => s + (k.weight * k.completion / 100), 0);
  const r = rules.find(r => total >= r.min && total < r.max);
  return r ? Math.round(maxBonus * r.mult) : 0;
}

export type PayrollInput = {
  grossSalary: number;
  insuranceSalary: number;
  workDaysStandard: number;
  workDaysActual: number;
  bonus: number;
  isCTV: boolean;
  isTrialPeriod: boolean;
  dependentCount: number;
  advance: number;

  allowance?: number;
};

export function calcPayroll(i: PayrollInput) {
  const salaryByWorkdays = calcWorkdaySalary(i.grossSalary, i.workDaysActual, i.workDaysStandard, i.isTrialPeriod);
  const allowance = i.allowance ?? 0;
  const totalIncome = salaryByWorkdays + i.bonus;

  const ins = calcInsurance(i.insuranceSalary, i.isCTV || i.isTrialPeriod);
  const personalDeduction = LAW_2026.personalDeduction;
  const dependentDeduction = i.dependentCount * LAW_2026.dependentDeduction;

  const taxableIncome = Math.max(0, totalIncome - ins.employee - personalDeduction - dependentDeduction);
  const tax = calcTax(taxableIncome);
  const netSalary = totalIncome - ins.employee - tax - i.advance + allowance;
  const totalCompanyCost = totalIncome + ins.employer + allowance;
  return {
    salaryByWorkdays,
    allowance,
    totalIncome,
    employeeInsurance: ins.employee,
    employerInsurance: ins.employer,
    insuranceBase: ins.base,
    personalDeduction,
    dependentDeduction,
    taxableIncome,
    tax,
    netSalary,
    totalCompanyCost
  };
}

export function grossUpFromNet(targetNet: number, p: Omit<PayrollInput, "grossSalary">): number {
  if (!targetNet || targetNet <= 0) return 0;
  let lo = 0;
  let hi = Math.max(targetNet * 4, 100_000_000);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const net = calcPayroll({ ...p, grossSalary: mid }).netSalary;
    if (net < targetNet) lo = mid; else hi = mid;
  }
  return Math.round(hi / 1000) * 1000;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function toVNMinutes(iso: string): number {
  const utc = new Date(iso);
  const vn = new Date(utc.getTime() + 7 * 3600 * 1000);
  return vn.getUTCHours() * 60 + vn.getUTCMinutes();
}

export function vnDateStr(d: Date = new Date()): string {
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  return vn.toISOString().slice(0, 10);
}

export function fmtTimeVN(t: string | null | undefined): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

export function calcLateMinutes(checkInISO: string): number {
  const minutes = toVNMinutes(checkInISO);
  const morningStart = timeToMinutes(WORK_HOURS.morningStart);
  const morningEnd = timeToMinutes(WORK_HOURS.morningEnd);
  const afternoonStart = timeToMinutes(WORK_HOURS.afternoonStart);
  const afternoonEnd = timeToMinutes(WORK_HOURS.afternoonEnd);
  const grace = WORK_HOURS.graceMinutes;

  if (minutes <= morningStart + grace) return 0;

  if (minutes < morningEnd) return Math.min(minutes - morningStart, 240);

  if (minutes <= afternoonStart + grace) return 0;

  if (minutes < afternoonEnd) return Math.min(minutes - afternoonStart, 240);

  return 240;
}

export function calcEarlyLeaveMinutes(checkOutISO: string): number {
  const minutes = toVNMinutes(checkOutISO);
  const morningEnd = timeToMinutes(WORK_HOURS.morningEnd);
  const afternoonStart = timeToMinutes(WORK_HOURS.afternoonStart);
  const afternoonEnd = timeToMinutes(WORK_HOURS.afternoonEnd);
  const grace = WORK_HOURS.graceMinutes;

  if (minutes >= afternoonEnd - grace) return 0;
  if (minutes > afternoonStart) return afternoonEnd - minutes;
  if (minutes >= morningEnd) return afternoonEnd - afternoonStart;

  return (morningEnd - minutes) + (afternoonEnd - afternoonStart);
}

export function calcOutDuringWorkMinutes(fromTime: string, toTime: string): number {
  const from = timeToMinutes(fromTime);
  const to = timeToMinutes(toTime);
  let total = to - from;
  const lunchStart = timeToMinutes("12:00");
  const lunchEnd = timeToMinutes(WORK_HOURS.afternoonStart);
  if (from < lunchEnd && to > lunchStart) {
    const overlap = Math.min(to, lunchEnd) - Math.max(from, lunchStart);
    total -= Math.max(0, overlap);
  }
  return Math.max(0, total);
}

export function minutesToWorkDayDeduction(totalMinutes: number): number {
  return totalMinutes / (WORK_HOURS.hoursPerDay * 60);
}

export const fmtVND = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
