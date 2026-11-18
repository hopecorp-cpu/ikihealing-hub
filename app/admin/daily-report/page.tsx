import { requireManager } from "@/lib/auth-server";
import { getDailyReportsByDepartment, getWeeklyComplianceTrend } from "./actions";
import { DailyReportAdminClient } from "./client";
import { MessageSquare, Users, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function AdminDailyReportPage({ searchParams }: { searchParams: { d?: string } }) {
  await requireManager();
  const { t } = getT();
  const date = searchParams.d ?? vnDateStr();

  const [data, weeklyTrend] = await Promise.all([
    getDailyReportsByDepartment(date),
    getWeeklyComplianceTrend(),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-brand-600" />
          {t("Báo cáo cuối ngày")} <span className="text-gray-400 text-base font-normal">· {date}</span>
        </h1>
        <form className="flex items-center gap-2">
          <label className="text-sm">{t("Ngày:")}</label>
          <input type="date" name="d" defaultValue={date}
            className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label={t("ĐÃ NỘP")} value={`${data.overall.submitted}/${data.overall.totalUsers}`}
          sub={`${data.overall.totalUsers > 0 ? Math.round((data.overall.submitted / data.overall.totalUsers) * 100) : 0}%`}
          color="#10B981" icon={Users}
          pulse={data.overall.submitted < data.overall.totalUsers} />
        <KPI label={t("ĐÃ REVIEW")} value={`${data.overall.reviewed}/${data.overall.submitted}`}
          color="#3B82F6" icon={TrendingUp} />
        <KPI label={t("VƯỚNG MẮC")} value={String(data.overall.blockers)}
          color={data.overall.blockers > 0 ? "#EF4444" : "#6B7280"} icon={AlertTriangle}
          pulse={data.overall.blockers > 0} />
        <KPI label={t("GỌI / CHỐT")} value={`${data.overall.totalCalls} / ${data.overall.totalOrders}`}
          color="#8B5CF6" icon={Users} sub={t("cuộc gọi / đơn")} />
        <KPI label={t("DOANH THU NGÀY")} value={fmtVND(data.overall.totalRevenue)}
          color="#F59E0B" icon={DollarSign} />
      </div>

      <DailyReportAdminClient data={data} weeklyTrend={weeklyTrend} />
    </div>
  );
}

function KPI({ label, value, color, icon: Icon, sub, pulse }: any) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 ${pulse ? "ring-2 ring-amber-200" : ""}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs uppercase font-semibold text-gray-500">{label}</div>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
