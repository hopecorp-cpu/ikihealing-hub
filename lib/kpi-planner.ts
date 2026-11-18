import { ACME_TARGETS } from "./bi-targets";

export type CascadeInput = {
  monthTarget: number;
  workDaysPerMonth: number;
  weeksPerMonth: number;
  aov: number;
  ordersPerCustomer: number;
  closeRate: number;
};

export type Cascade = {
  quarter: number; month: number; week: number; day: number;
  ordersMonth: number; ordersWeek: number; ordersDay: number;
  customersMonth: number; customersWeek: number; customersDay: number;
  leadsMonth: number; leadsWeek: number; leadsDay: number;
};

export function decomposeTarget(i: CascadeInput): Cascade {
  const weeks = i.weeksPerMonth > 0 ? i.weeksPerMonth : 4.33;
  const days = i.workDaysPerMonth > 0 ? i.workDaysPerMonth : 26;
  const opc = i.ordersPerCustomer > 0 ? i.ordersPerCustomer : 1;
  const cr = i.closeRate > 0 ? i.closeRate : 1;

  const ordersMonth = i.aov > 0 ? i.monthTarget / i.aov : 0;
  const customersMonth = ordersMonth / opc;
  const leadsMonth = ordersMonth / cr;

  return {
    quarter: i.monthTarget * 3,
    month: i.monthTarget,
    week: i.monthTarget / weeks,
    day: i.monthTarget / days,
    ordersMonth, ordersWeek: ordersMonth / weeks, ordersDay: ordersMonth / days,
    customersMonth, customersWeek: customersMonth / weeks, customersDay: customersMonth / days,
    leadsMonth, leadsWeek: leadsMonth / weeks, leadsDay: leadsMonth / days,
  };
}

export type ComboInput = {
  name: string;
  listPrice: number;
  marginPct: number;
  giftName: string;
  giftCost: number;
  sharePct: number;
};

export type ComboResult = ComboInput & {
  cost: number;
  marginAfterPct: number;
  revContribution: number;
  unitsNeeded: number;
  grossProfit: number;
  giftTotalCost: number;
  vsDiscount10: number;
  marginWarn: boolean;
};

export function planCombos(monthTarget: number, combos: ComboInput[], marginMin = ACME_TARGETS.marginMin): {
  rows: ComboResult[];
  totalShare: number;
  totalRev: number;
  totalUnits: number;
  totalGrossProfit: number;
  totalGiftCost: number;
  blendedMarginPct: number;
} {
  const rows = combos.map(c => {
    const baseCost = c.listPrice * (1 - c.marginPct / 100);
    const cost = baseCost + c.giftCost;
    const marginAfterPct = c.listPrice > 0 ? (c.listPrice - cost) / c.listPrice * 100 : 0;
    const revContribution = monthTarget * c.sharePct / 100;
    const unitsNeeded = c.listPrice > 0 ? revContribution / c.listPrice : 0;
    const grossProfit = (c.listPrice - cost) * unitsNeeded;
    const giftTotalCost = c.giftCost * unitsNeeded;

    const vsDiscount10 = (c.listPrice * 0.10 - c.giftCost) * unitsNeeded;
    return { ...c, cost: Math.round(cost), marginAfterPct, revContribution, unitsNeeded, grossProfit, giftTotalCost, vsDiscount10, marginWarn: marginAfterPct < marginMin };
  });
  const totalShare = combos.reduce((s, c) => s + c.sharePct, 0);
  const totalRev = rows.reduce((s, r) => s + r.revContribution, 0);
  const totalUnits = rows.reduce((s, r) => s + r.unitsNeeded, 0);
  const totalGrossProfit = rows.reduce((s, r) => s + r.grossProfit, 0);
  const totalGiftCost = rows.reduce((s, r) => s + r.giftTotalCost, 0);
  const blendedMarginPct = totalRev > 0 ? totalGrossProfit / totalRev * 100 : 0;
  return { rows, totalShare, totalRev, totalUnits, totalGrossProfit, totalGiftCost, blendedMarginPct };
}

export const DEFAULT_COMBOS: ComboInput[] = [
  { name: "Đạm Mẫu — Combo 3 hộp", listPrice: 2_700_000, marginPct: 82, giftName: "Lớp Sống Khoẻ 3 ngày (Zoom) + 1 Trà Mẫu A", giftCost: 36_000, sharePct: 40 },
  { name: "Combo Sống Khoẻ 7 ngày (NOVA)", listPrice: 1_490_000, marginPct: 65, giftName: "Lớp dinh dưỡng qua Zoom + đồng hành 7 ngày", giftCost: 0, sharePct: 35 },
  { name: "Combo Khởi Đầu Sống Khoẻ", listPrice: 1_050_000, marginPct: 66, giftName: "Lớp Sống Khoẻ 3 ngày (Zoom)", giftCost: 0, sharePct: 25 },
];
