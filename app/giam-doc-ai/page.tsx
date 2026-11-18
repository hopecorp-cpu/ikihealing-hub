import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { getConfigValue } from "@/lib/app-config";
import { vnDateStr } from "@/lib/payroll";
import { GiamDocAIClient } from "./Client";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Giám đốc Kinh doanh AI | ACME Ops Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role))) redirect("/");

  const month = vnDateStr().slice(0, 7);
  const l = await computeRevenueLoop(month);

  let lowCount = 0, outCount = 0;
  try { const raw = await getConfigValue("misa_stock"); if (raw) { const p = JSON.parse(raw); for (const it of (p.items || [])) { if (it.closing > 0 && it.closing <= 10) lowCount++; else if (it.closing === 0) outCount++; } } } catch { }

  let cached: any = null;
  try { const raw = await getConfigValue(`ai_director_${month}`); if (raw) cached = JSON.parse(raw); } catch { }

  const kpi = {
    month,
    monthActual: l.monthActual, monthTarget: l.monthTarget, pacePct: l.pacePct, expectedPct: l.expectedPct, finLight: l.finLight,
    mktPct: l.mktPct, mktLight: l.mktLight, mktOverBudgetWarn: l.mktOverBudgetWarn,
    behind: (l.sales || []).filter((s: any) => s.behind).map((s: any) => ({ name: s.name, pct: s.pct })),
    needGap: l.needGap, needOrders: l.needOrders,
    lowCount, outCount,
  };

  return <GiamDocAIClient kpi={kpi} cached={cached} canAssign />;
}
