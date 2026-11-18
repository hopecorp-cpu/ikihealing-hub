import { redirect } from "next/navigation";

import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { getSaleSnapshot, norm } from "@/lib/sale-metrics";
import { calcPace } from "@/lib/bi-targets";
import { Stat } from "@/components/stat";
import { Trophy } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function KpiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { t } = getT();
  const sb = getServiceClient();

  const today = vnDateStr();
  const month = today.slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const dElapsed = +today.slice(8, 10);
  const expectedPct = Math.round(dElapsed / dim * 100);

  const [{ me, leaderboard }, { data: kpis }] = await Promise.all([
    getSaleSnapshot(user.full_name, month),
    sb.from("kpis").select("*, cycles(name)").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const pace = me ? calcPace(me.revenue, dElapsed, dim, me.target) : null;
  const pctColor = !me || me.pct == null ? "#9CA3AF" : me.pct >= 100 ? "#10B981" : me.pct >= expectedPct ? "#3B82F6" : "#EF4444";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("KPI của tôi")}</h1>

      {me && (
        <>
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{t("Doanh số tháng")} {month.slice(5)}/{month.slice(0, 4)}</h2>
              <span className="text-xs text-gray-400">{t("đã qua")} {expectedPct}% {t("tháng · cập nhật từ MISA")}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={t("Đã đạt")} value={fmtVND(me.revenue)} color={pctColor} hint={me.pct == null ? "" : `${me.pct}% KPI`} />
              <Stat label={t("Mục tiêu tháng")} value={fmtVND(me.target)} color="#6B7280" hint={`${t("kỳ vọng")} ${expectedPct}%`} />
              <Stat label={t("Đơn · Khách")} value={`${me.orders} · ${me.custs}`} color="#8B5CF6" />
              <Stat label={t("Hạng team")} value={`#${me.rank}/${me.teamSize}`} color="#F59E0B" hint={me.chatScore != null ? `${t("chat")} ${me.chatScore}/10` : ""} />
            </div>
            <div className="mt-3">
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, me.pct || 0)}%`, background: pctColor }} />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                <span>{me.pct ?? 0}% KPI {me.pct != null && me.pct < expectedPct ? t("· đang chậm nhịp") : ""}</span>
                {pace && <span>{t("Dự kiến cuối tháng:")} {fmtVND(pace.projectedEndOfPeriod)} ({Math.round(pace.projectedPercent)}%) · {t("cần")} {fmtVND(pace.dailyRateNeeded)}{t("/ngày")}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-sm">
              <span className={me.careMonth > 0 ? "text-emerald-600" : "text-gray-400"}>{t("chăm")} {me.careMonth} {t("khách/tháng")}</span>
              <span className={me.callsMonth > 0 ? "text-blue-600" : "text-gray-400"}>{t("gọi")} {me.callsMonth}{t("/tháng")}</span>
              {me.unreplied && me.unreplied.count > 0 && <span className="text-red-600">⏳ {me.unreplied.count} {t("khách đang chờ trả lời")}</span>}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> {t("Bảng xếp hạng team")}</h2>
            <div className="space-y-1.5">
              {leaderboard.map((m) => {
                const meRow = norm(m.name) === norm(user.full_name);
                const medal = m.rank === 1 ? "" : m.rank === 2 ? "" : m.rank === 3 ? "" : `#${m.rank}`;
                return (
                  <div key={m.userId} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${meRow ? "bg-blue-50 border border-blue-200 font-semibold" : "bg-gray-50"}`}>
                    <span className="w-8 text-center">{medal}</span>
                    <span className="flex-1 truncate">{m.name}{meRow ? " " + t("(bạn)") : ""}</span>
                    <span className="tabular-nums">{fmtVND(m.revenue)}</span>
                    <span className="w-12 text-right text-xs" style={{ color: m.pct == null ? "#9CA3AF" : m.pct >= 100 ? "#10B981" : "#6B7280" }}>{m.pct == null ? "—" : m.pct + "%"}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold">{t("KPI theo chu kỳ")}</h2>
          <button className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm">+ {t("Đề xuất KPI mới")}</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr><th className="text-left p-3">{t("Tiêu đề")}</th><th className="text-left p-3">{t("Chu kỳ")}</th><th className="text-right p-3">{t("Mục tiêu")}</th><th className="text-right p-3">{t("Hiện tại")}</th><th className="text-right p-3">% HT</th><th className="text-left p-3">{t("Trạng thái")}</th></tr>
          </thead>
          <tbody>
            {(kpis ?? []).map((k: any) => {
  const { t: t } = getT();
              const pct = k.target_value ? Math.round(k.current_value / k.target_value * 100) : 0;
              return (
                <tr key={k.id} className="border-t border-gray-100">
                  <td className="p-3 font-medium">{t(k.title)}</td>
                  <td className="p-3">{k.cycles?.name}</td>
                  <td className="p-3 text-right">{k.target_value} {k.metric_unit}</td>
                  <td className="p-3 text-right">{k.current_value} {k.metric_unit}</td>
                  <td className="p-3 text-right">
                    <span className={pct >= 100 ? "text-brand-700 font-bold" : pct >= 70 ? "text-yellow-600" : "text-red-600"}>{pct}%</span>
                  </td>
                  <td className="p-3 text-xs">{k.status}</td>
                </tr>
              );
            })}
            {(!kpis || kpis.length === 0) && <tr><td colSpan={6} className="p-8 text-center text-gray-400">{me ? t("Doanh số tháng đã hiện ở trên. Mục này dành cho KPI bổ sung theo chu kỳ.") : t("Chưa có KPI — bấm \"Đề xuất KPI mới\" để tạo")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

