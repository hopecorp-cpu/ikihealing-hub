import { requireAdmin } from "@/lib/auth-server";
import { getAllAttendance, getPendingCorrectionRequests, getTodayAttendance, getMonthlyWorkSummary, getGpsUnverifiedAttendance } from "./actions";
import { AttendanceAdminClient } from "./client";
import { GpsReviewSection } from "./gps-review";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { AlertTriangle, ClockIcon, Edit3, FileWarning, CalendarCheck2 } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function AdminChamCongPage({ searchParams }: { searchParams: { m?: string; d?: string; tab?: string } }) {
  await requireAdmin();
  const { t } = getT();
  const month = searchParams.m ?? vnDateStr().slice(0, 7);
  const todayDate = searchParams.d ?? vnDateStr();
  const initialTab = searchParams.tab ?? "today";

  const [attendance, requests, todayData, workSummary, gpsUnverified] = await Promise.all([
    getAllAttendance(month),
    getPendingCorrectionRequests(),
    getTodayAttendance(todayDate),
    getMonthlyWorkSummary(month),
    getGpsUnverifiedAttendance(month),
  ]);

  const missedCheckout = attendance.filter((a: any) => a.missed_checkout).length;
  const missedCheckin = attendance.filter((a: any) => a.missed_checkin).length;
  const totalPenalty = attendance.reduce((s: number, a: any) => s + (a.penalty_amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Edit3 className="w-6 h-6 text-brand-600" /> {t("Quản lý chấm công (Admin)")}
        </h1>
        <form className="flex items-center gap-2">
          <label className="text-sm">{t("Tháng:")}</label>
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label={t("ĐƠN XIN SỬA")} value={String(requests.length)} color="#F59E0B" icon={FileWarning} />
        <KPI label={t("QUÊN CHECK-OUT")} value={String(missedCheckout)} color="#EF4444" icon={ClockIcon} />
        <KPI label={t("QUÊN CHECK-IN")} value={String(missedCheckin)} color="#EF4444" icon={AlertTriangle} />
        <KPI label={t("TỔNG PHẠT")} value={fmtVND(totalPenalty)} color="#DC2626" icon={AlertTriangle} />
      </div>

      <GpsReviewSection rows={gpsUnverified} month={month} />

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <CalendarCheck2 className="w-5 h-5 text-emerald-600" />
          <h2 className="font-semibold">{t("Tổng hợp công tháng")} {month} {t("— từng nhân viên")}</h2>
          <span className="text-xs text-gray-400 ml-auto">{t("NC chuẩn")} {workSummary.ncStandard} {t("ngày · NC tính lương = công thật − trễ/sớm − nghỉ không lương/ra ngoài")}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-3">{t("Nhân viên")}</th>
                <th className="text-center p-3">{t("Ngày công")}</th>
                <th className="text-center p-3">{t("Đi muộn")}</th>
                <th className="text-center p-3">{t("Về sớm")}</th>
                <th className="text-center p-3">{t("Nghỉ phép")}</th>
                <th className="text-center p-3">{t("Nghỉ ốm")}</th>
                <th className="text-center p-3">{t("Không lương")}</th>
                <th className="text-center p-3">{t("Ra ngoài")}</th>
                <th className="text-center p-3 bg-emerald-50">{t("NC tính lương")}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {workSummary.rows.map((r: any) => (
                <tr key={r.user_id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-medium whitespace-nowrap">{r.full_name}</div>
                    <div className="text-[11px] text-gray-500 whitespace-nowrap">{r.position}{r.dept ? ` · ${r.dept}` : ""}</div>
                  </td>
                  <td className="p-3 text-center font-semibold">
                    {r.isPartTime
                      ? <span className="text-blue-700 whitespace-nowrap">{r.ptHours}h <span className="text-[10px] font-normal text-gray-400">({r.ptDays} {t("ngày ·")} {r.ptShiftCount} ca{r.hourlyRate ? ` = ${(r.ptSalary || 0).toLocaleString("vi-VN")}đ` : ""})</span></span>
                      : r.workDays}
                  </td>
                  <td className="p-3 text-center">{r.lateCount ? <span className="text-orange-600">{r.lateCount} {t("lần")} · {r.lateMin}′</span> : "—"}</td>
                  <td className="p-3 text-center">{r.earlyMin ? <span className="text-orange-600">{r.earlyMin}′</span> : "—"}</td>
                  <td className="p-3 text-center">{r.phep || "—"}</td>
                  <td className="p-3 text-center">{r.om || "—"}</td>
                  <td className="p-3 text-center">{r.khongLuong ? <span className="text-red-600 font-medium">{r.khongLuong}</span> : "—"}</td>
                  <td className="p-3 text-center">{r.raNgoai || "—"}</td>
                  <td className="p-3 text-center font-bold bg-emerald-50/50">{r.isPartTime ? <span className="text-blue-700 text-[11px] whitespace-nowrap">{t("theo giờ")}: {r.ptHours}h</span> : r.ncPaid}</td>
                </tr>
              ))}
              {workSummary.rows.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">{t("Chưa có dữ liệu chấm công tháng này")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AttendanceAdminClient
        attendance={attendance}
        requests={requests}
        month={month}
        today={todayData}
        initialTab={initialTab}
      />
    </div>
  );
}

function KPI({ label, value, color, icon: Icon }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-gray-500 uppercase font-semibold">{label}</div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "22" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
