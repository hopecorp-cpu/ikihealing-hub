import { requireAdmin } from "@/lib/auth-server";
import { getT } from "@/lib/i18n-server";
import { getServiceClient } from "@/lib/supabase-server";
import { fmtVND } from "@/lib/payroll";
import { BankReconcileClient } from "./client";
import { getAllCategoriesInUse } from "./actions";
import { Banknote, TrendingUp, TrendingDown, Equal, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KeToanPage({ searchParams }: { searchParams: { m?: string; tab?: string } }) {
  await requireAdmin();
  const { t } = getT();
  const month = searchParams.m ?? new Date().toISOString().slice(0, 7);
  const tab = searchParams.tab ?? "review";

  const [y, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const monthStart = `${month}-01`;

  const sb = getServiceClient();
  const [
    { data: statements },
    { data: txns },
    { data: expenses },
    { data: orders },
    { data: sales },
    allCategoriesInUse
  ] = await Promise.all([
    sb.from("bank_statements").select("*").order("uploaded_at", { ascending: false }).limit(20),
    sb.from("bank_transactions").select("*").gte("txn_date", monthStart).lt("txn_date", nextMonth).order("txn_date", { ascending: false }),
    sb.from("expenses").select("*, users!expenses_paid_by_fkey(full_name)").gte("expense_date", monthStart).lt("expense_date", nextMonth).order("expense_date", { ascending: false }),
    sb.from("orders").select("final_revenue, channel, order_date").gte("order_date", monthStart).lt("order_date", nextMonth),
    sb.from("users").select("id, full_name, position").eq("active", true).ilike("position", "%sale%"),
    getAllCategoriesInUse()
  ]);

  const credits = (txns ?? []).filter((t: any) => t.type === "credit" && t.category !== "internal_transfer" && t.category !== "ignored");
  const debits = (txns ?? []).filter((t: any) => t.type === "debit" && t.category !== "internal_transfer" && t.category !== "ignored");
  const totalThu = credits.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  const totalChi = debits.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  const netCashFlow = totalThu - totalChi;
  const unmatched = (txns ?? []).filter((t: any) => !t.reviewed).length;

  const totalRevenueInDB = (orders ?? []).reduce((s: number, o: any) => s + (o.final_revenue || 0), 0);
  const gap = totalThu - totalRevenueInDB;

  const expenseByCategory: Record<string, number> = {};
  debits.forEach((t: any) => {
    const cat = t.category || "expense_other";
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Math.abs(t.amount);
  });

  const revenueByCategory: Record<string, number> = {};
  credits.forEach((t: any) => {
    const cat = t.category || "revenue_other";
    revenueByCategory[cat] = (revenueByCategory[cat] || 0) + Math.abs(t.amount);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-600" /> {t("Đối soát Bank — Tiền vào & Tiền ra")}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{t("Tháng")} {month} · {t("Bank = ground truth doanh thu + chi phí thật")}</p>
        </div>
        <form className="flex items-center gap-2">
          <label className="text-sm">{t("Tháng:")}</label>
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigKPI label={t("TIỀN VÀO (Thu)")} value={fmtVND(totalThu)} sub={`${credits.length} ${t("giao dịch")}`} color="#10B981" icon={TrendingUp} />
        <BigKPI label={t("TIỀN RA (Chi)")} value={fmtVND(totalChi)} sub={`${debits.length} ${t("giao dịch")}`} color="#EF4444" icon={TrendingDown} />
        <BigKPI label={t("CASH FLOW")} value={fmtVND(netCashFlow)} sub={netCashFlow >= 0 ? t("Dương — OK") : t("Âm — chú ý")} color={netCashFlow >= 0 ? "#10B981" : "#EF4444"} icon={Equal} />
        <BigKPI label={t("CHƯA REVIEW")} value={String(unmatched)} sub={t("giao dịch cần phân loại")} color={unmatched > 0 ? "#F59E0B" : "#10B981"} icon={Activity} />
      </div>

      {Math.abs(gap) > 100_000 && (
        <div className={`border rounded-xl p-4 flex items-start gap-3 ${gap > 0 ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200"}`}>
          <Activity className={`w-5 h-5 mt-0.5 ${gap > 0 ? "text-orange-600" : "text-blue-600"}`} />
          <div className="flex-1 text-sm">
            <div className="font-semibold">
              {gap > 0
                ? `${t("Bank thu nhiều hơn DB")} ${fmtVND(gap)} ${t("— có đơn chưa nhập")}`
                : `${t("DB ghi nhận nhiều hơn bank thu")} ${fmtVND(-gap)} ${t("— có đơn chưa thu tiền")}`}
            </div>
            <div className="text-xs mt-1">
              {t("Bank credit:")} <b>{fmtVND(totalThu)}</b> · {t("DB orders:")} <b>{fmtVND(totalRevenueInDB)}</b>
            </div>
          </div>
        </div>
      )}

      <BankReconcileClient
        txns={txns ?? []}
        statements={statements ?? []}
        expenses={expenses ?? []}
        sales={sales ?? []}
        revenueByCategory={revenueByCategory}
        expenseByCategory={expenseByCategory}
        month={month}
        currentTab={tab}
        totalThu={totalThu}
        totalChi={totalChi}
        allCategoriesInUse={allCategoriesInUse}
      />
    </div>
  );
}

function BigKPI({ label, value, sub, color, icon: Icon }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs uppercase font-semibold text-gray-500">{label}</div>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
