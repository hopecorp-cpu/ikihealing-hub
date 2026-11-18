import { requireAdmin } from "@/lib/auth-server";
import { getAllLeaves, getLeaveStats } from "./actions";
import { LeavesAdminClient } from "./client";
import { CalendarOff, Clock, CheckCircle2, XCircle } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function AdminLeavesPage({ searchParams }: { searchParams: { y?: string } }) {
  await requireAdmin();
  const { t } = getT();
  const year = parseInt(searchParams.y || new Date().getFullYear().toString());

  const [allLeaves, stats] = await Promise.all([
    getAllLeaves({ year }),
    getLeaveStats(year),
  ]);

  const pending = allLeaves.filter((l: any) => l.status === "pending");
  const approved = allLeaves.filter((l: any) => l.status === "approved");
  const rejected = allLeaves.filter((l: any) => l.status === "rejected");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarOff className="w-6 h-6 text-brand-600" /> {t("Duyệt nghỉ phép")}
        </h1>
        <form className="flex items-center gap-2">
          <label className="text-sm">{t("Năm:")}</label>
          <input type="number" name="y" defaultValue={year} min={2024} max={2030}
            className="p-2 border border-gray-200 rounded-lg text-sm w-24" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={t("CHỜ DUYỆT")} value={String(pending.length)} color="#F59E0B" icon={Clock} pulse={pending.length > 0} />
        <KPI label={t("ĐÃ DUYỆT")} value={String(approved.length)} color="#10B981" icon={CheckCircle2} />
        <KPI label={t("TỪ CHỐI")} value={String(rejected.length)} color="#EF4444" icon={XCircle} />
        <KPI label={t("TỔNG NGÀY NGHỈ")} value={stats.totalDays.toFixed(1)} color="#3B82F6" icon={CalendarOff} sub={t("(đã duyệt)")} />
      </div>

      <LeavesAdminClient
        pending={pending}
        approved={approved}
        rejected={rejected}
        statsByType={stats.byType}
      />
    </div>
  );
}

function KPI({ label, value, color, icon: Icon, sub, pulse }: any) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 ${pulse ? "ring-2 ring-yellow-200 animate-pulse" : ""}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs uppercase font-semibold text-gray-500">{label}</div>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
