import { requireAdmin } from "@/lib/auth-server";
import { getT } from "@/lib/i18n-server";
import { getServiceClient } from "@/lib/supabase-server";
import { fmtVND } from "@/lib/payroll";
import { LoansClient } from "./client";
import { Banknote, AlertTriangle, CheckCircle2, Clock, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  await requireAdmin();
  const { t } = getT();
  const sb = getServiceClient();

  let loans: any[] = [];
  let payments: any[] = [];
  let migrationOk = true;
  try {
    const [{ data: l }, { data: p }] = await Promise.all([
      sb.from("loans").select("*").order("start_date", { ascending: false }),
      sb.from("loan_payments").select("*, loans(contract_code, lender)").order("period_start", { ascending: false })
    ]);
    loans = l ?? [];
    payments = p ?? [];
  } catch (e: any) {
    migrationOk = false;
  }

  if (!migrationOk || (loans.length === 0 && payments.length === 0)) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">{t("Quản lý Nợ vay")}</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <AlertTriangle className="w-8 h-8 text-yellow-600 mb-3" />
          <h2 className="font-bold text-yellow-900">{t("Chưa có data nợ vay")}</h2>
          <p className="text-sm text-yellow-800 mt-2">
            {t("Cần 2 bước:")}
          </p>
          <ol className="list-decimal ml-5 mt-2 text-sm text-yellow-800 space-y-1">
            <li>{t("Chạy migration 015 trên Supabase (file:")} <code>/Users/NguyenHung/Downloads/BUOC5-loans.sql</code>)</li>
            <li>{t("Quay lại trang này → seed sẽ tự chạy")}</li>
          </ol>
          <p className="text-xs text-yellow-700 mt-3">
            {t('Hoặc bấm nút "Seed data mẫu" bên dưới sau khi migration đã chạy.')}
          </p>
          <LoansClient loans={[]} payments={[]} needSeed={true} />
        </div>
      </div>
    );
  }

  const totalOutstanding = loans.reduce((s, l) => s + (l.outstanding_principal || 0), 0);
  const totalPrincipal = loans.reduce((s, l) => s + (l.principal_amount || 0), 0);
  const paidOff = totalPrincipal - totalOutstanding;
  const upcomingPayments = payments.filter(p => p.status === "pending" && p.due_date && new Date(p.due_date) > new Date());
  const overdue = payments.filter(p => p.status === "pending" && p.due_date && new Date(p.due_date) < new Date());
  const totalPaidInterest = payments.filter(p => p.status === "paid" && p.payment_type === "interest").reduce((s, p) => s + (p.net_amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="w-6 h-6 text-red-600" /> {t("Quản lý Nợ vay")}
        </h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={t("DƯ NỢ HIỆN TẠI")} value={fmtVND(totalOutstanding)} color="#EF4444" icon={TrendingDown} sub={`${loans.filter(l => l.status === "active").length} ${t("HĐ active")}`} />
        <KPI label={t("ĐÃ TẤT TOÁN")} value={fmtVND(paidOff)} color="#10B981" icon={CheckCircle2} sub={`${loans.filter(l => l.status === "paid_off").length} ${t("HĐ paid off")}`} />
        <KPI label={t("LÃI ĐÃ TRẢ")} value={fmtVND(totalPaidInterest)} color="#F59E0B" icon={Clock} sub={`${payments.filter(p => p.status === "paid" && p.payment_type === "interest").length} ${t("kỳ")}`} />
        <KPI label={t("SẮP ĐẾN HẠN")} value={String(upcomingPayments.length)} color={overdue.length > 0 ? "#EF4444" : "#3B82F6"} icon={AlertTriangle} sub={overdue.length > 0 ? `${overdue.length} ${t("đã quá hạn")}` : t("kỳ pending")} />
      </div>

      <LoansClient loans={loans} payments={payments} needSeed={false} />
    </div>
  );
}

function KPI({ label, value, sub, color, icon: Icon }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs uppercase font-semibold text-gray-500">{label}</div>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-lg font-bold leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
