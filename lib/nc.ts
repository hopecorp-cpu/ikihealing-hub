import { LAW_2026 } from "./payroll";

export function workingDaysBetween(startISO: string, endInclusiveISO: string): number {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endInclusiveISO + "T00:00:00");
  if (end < start) return 0;
  let n = 0;
  const d = new Date(start);
  while (d <= end) {
    if (d.getDay() !== 0) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function leaveDaysInMonth(leave: { from_date?: string | null; to_date?: string | null; days?: number | null }, month: string): number {
  const from = leave.from_date;
  if (!from) return 0;
  const to = leave.to_date || from;
  const [y, m] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
  if (to < monthStart || from > monthEnd) return 0;
  if (from >= monthStart && to <= monthEnd) return leave.days || 0;
  const cf = from < monthStart ? monthStart : from;
  const ct = to > monthEnd ? monthEnd : to;
  return workingDaysBetween(cf, ct);
}

export type NCInput = {
  month: string;
  hireDate?: string | null;
  terminatedAt?: string | null;
  unpaidLeaveDays?: number;
  lateEarlyMinutes?: number;
};

export function computeMonthlyNC(input: NCInput): { ncStandard: number; ncActual: number } {
  const ncStandard = LAW_2026.workDaysStandard;
  const [y, m] = input.month.split("-").map(Number);
  const monthStart = `${input.month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${input.month}-${String(lastDay).padStart(2, "0")}`;

  const empStart = input.hireDate && input.hireDate > monthStart ? input.hireDate : monthStart;
  let empEnd = monthEnd;
  if (input.terminatedAt && input.terminatedAt <= monthEnd) {
    const t = new Date(input.terminatedAt + "T00:00:00");
    t.setDate(t.getDate() - 1);
    empEnd = fmtLocal(t);
  }

  if (empStart > monthEnd || empEnd < monthStart) return { ncStandard, ncActual: 0 };

  const fullMonth = empStart <= monthStart && empEnd >= monthEnd;
  const ncBase = fullMonth
    ? ncStandard
    : Math.min(workingDaysBetween(empStart, empEnd), ncStandard);

  let nc = ncBase - (input.unpaidLeaveDays || 0) - (input.lateEarlyMinutes || 0) / 480;
  nc = Math.max(0, Math.round(nc * 10) / 10);
  return { ncStandard, ncActual: nc };
}
