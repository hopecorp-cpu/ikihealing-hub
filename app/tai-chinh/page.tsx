import { getT } from "@/lib/i18n-server";
import financeData from "@/data/finance-data.json";
import FinanceDashboard from "./FinanceDashboard";
import FinancialRatios from "./FinancialRatios";
import CashFlow from "./CashFlow";
import { getConfigValue } from "@/lib/app-config";
import { computeCashFlow } from "@/lib/cashflow";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Chi phí & Lợi nhuận | IKIHEALING Hub") };
}

export default async function TaiChinhPage() {
  const raw = await getConfigValue("balance_sheet");
  let balance: Record<string, any> = {};
  try { balance = raw ? JSON.parse(raw) : {}; } catch { balance = {}; }
  const cf = await computeCashFlow();
  return (
    <>
      <FinanceDashboard data={financeData as any} />
      {cf && <CashFlow cf={cf} pnl={(financeData as any).pnl || []} />}
      <FinancialRatios pnl={(financeData as any).pnl || []} balance={balance} />
    </>
  );
}
