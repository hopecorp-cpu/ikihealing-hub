"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { LOOP_ASSUMPTIONS_KEY, DEFAULT_ASSUMPTIONS, mktSpendKey, leadsKey, type LoopAssumptions } from "@/lib/revenue-loop";
import { revalidatePath } from "next/cache";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export async function saveLoopAssumptions(input: {
  closeRatePct: number; ordersPerCustomer: number; grossMarginPct: number; desiredMarginPct: number;
  mktCostCapPct: number; mktSpend: number; month: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !(user.role === "admin" || user.role === "ceo")) return { ok: false, error: "Không có quyền" };
  const clean: LoopAssumptions = {
    closeRate: clamp01((Number(input.closeRatePct) || 15) / 100),
    ordersPerCustomer: Math.max(0.1, Number(input.ordersPerCustomer) || 1),
    grossMargin: clamp01((Number(input.grossMarginPct) || 66) / 100),
    desiredMargin: clamp01((Number(input.desiredMarginPct) || 30) / 100),
    mktCostCapPct: clamp01((Number(input.mktCostCapPct) || 15) / 100),
    workDaysPerMonth: DEFAULT_ASSUMPTIONS.workDaysPerMonth,
    weeksPerMonth: DEFAULT_ASSUMPTIONS.weeksPerMonth,
  };
  await setConfigValue(LOOP_ASSUMPTIONS_KEY, JSON.stringify(clean), "Giả định vòng lặp doanh thu");
  const spend = Math.max(0, Math.round(Number(input.mktSpend) || 0));
  if (/^\d{4}-\d{2}$/.test(input.month || "")) await setConfigValue(mktSpendKey(input.month), String(spend), "Chi phí MKT/ads tháng (nhập tay hoặc auto)");
  revalidatePath("/vong-lap-doanh-thu");
  return { ok: true };
}

export async function saveLeads(month: string, byChannel: Record<string, number>): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !(user.role === "admin" || user.role === "ceo" || user.role === "manager")) return { ok: false, error: "Không có quyền" };
  if (!/^\d{4}-\d{2}$/.test(month || "")) return { ok: false, error: "tháng sai" };
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(byChannel || {})) { const n = Math.max(0, Math.round(Number(v) || 0)); if (k.trim() && n > 0) clean[k.trim()] = n; }
  await setConfigValue(leadsKey(month), JSON.stringify({ byChannel: clean, source: "nhập tay", updatedAt: new Date().toISOString() }), "Lead đầu phễu theo kênh (gap #1)");
  revalidatePath("/vong-lap-doanh-thu");
  return { ok: true };
}
