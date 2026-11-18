import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { vnDateStr, fmtVND, detectSaleType } from "@/lib/payroll";
import { getAllSaleMetrics } from "@/lib/sale-metrics";
import { weightedCompletion, bandFactor } from "@/lib/dept-comp";
import { salesEventsForMonth, EVENT_LABEL } from "@/lib/sales-events";
import { Trophy, Flame, Target, Gift, Medal, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Bảng vinh danh | IKIHEALING Hub") };
}

const RANK_CLR = ["text-amber-500", "text-gray-400", "text-orange-600"];

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sb = getServiceClient();
  const today = vnDateStr();
  const month = today.slice(0, 7);

  const d30 = new Date(today + "T00:00:00"); d30.setDate(d30.getDate() - 30);
  const [saleAll, { data: cyc }, { data: reps }, { data: allUsers }] = await Promise.all([
    getAllSaleMetrics(month),
    sb.from("cycles").select("id, name").eq("status", "active").order("start_date", { ascending: false }).limit(1),
    sb.from("daily_reports").select("user_id, report_date").gte("report_date", d30.toISOString().slice(0, 10)),
    sb.from("users").select("id, full_name").eq("active", true),
  ]);
  const saleMetrics = saleAll.filter(s => s.revenue > 0 || (s.target || 0) > 0).slice(0, 10);

  const cycleId = cyc?.[0]?.id;
  const cycleName = cyc?.[0]?.name || month;
  let kpiBoard: { name: string; completion: number; band: string }[] = [];
  if (cycleId) {
    const [{ data: users }, { data: kpis }] = await Promise.all([
      sb.from("users").select("id, full_name, position").eq("active", true),
      sb.from("kpis").select("user_id, title, target_value, current_value, weight_percent, is_lower_better").eq("cycle_id", cycleId),
    ]);
    const nameOf = new Map((users ?? []).map((u: any) => [u.id, { name: u.full_name, sale: detectSaleType(u.position) !== "none" }]));
    const byUser: Record<string, any[]> = {};
    (kpis ?? []).forEach((k: any) => { (byUser[k.user_id] ||= []).push(k); });
    kpiBoard = Object.entries(byUser)
      .map(([uid, rows]) => ({ uid, ...(nameOf.get(uid) || { name: "—", sale: false }), completion: Math.round(weightedCompletion(rows as any)) }))
      .filter(x => !x.sale)
      .map(x => ({ name: x.name, completion: x.completion, band: bandFactor(x.completion).label }))
      .sort((a, b) => b.completion - a.completion);
  }

  const uname = new Map((allUsers ?? []).map((u: any) => [u.id, u.full_name]));
  const daysBy: Record<string, Set<string>> = {};
  (reps ?? []).forEach((r: any) => { (daysBy[r.user_id] ||= new Set()).add(r.report_date); });
  const streakOf = (dates: Set<string>) => {
    let n = 0; const d = new Date(today + "T00:00:00");

    if (!dates.has(today)) d.setDate(d.getDate() - 1);
    while (dates.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };
  const streaks = Object.entries(daysBy).map(([uid, set]) => ({ name: uname.get(uid) || "—", streak: streakOf(set) }))
    .filter(s => s.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 8);

  const weekEnd = new Date(today + "T00:00:00"); weekEnd.setDate(weekEnd.getDate() + 7);
  const events = salesEventsForMonth(month).filter(e => e.date >= today && e.date <= weekEnd.toISOString().slice(0, 10));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="w-6 h-6 text-amber-500" /> {t("Bảng vinh danh")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Thi đua toàn công ty tháng")} {month.slice(5)}/{month.slice(0, 4)} {t("— doanh số, KPI phòng ban, chuỗi báo cáo, và sự kiện thưởng nóng.")}</p>
      </div>

      {events.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><Gift className="w-5 h-5 text-amber-600" /><h2 className="font-semibold text-sm text-gray-800">{t("Sự kiện thưởng nóng tuần này")}</h2></div>
          <div className="flex flex-wrap gap-2">
            {events.map((e, i) => (
              <div key={i} className={`rounded-lg border px-3 py-2 bg-white ${e.big ? "border-amber-300" : "border-gray-200"}`}>
                <div className="text-xs text-gray-400">{e.date.slice(5)} · {EVENT_LABEL[e.type]}</div>
                <div className="text-sm font-medium text-gray-900">{e.name}</div>
                <div className="text-xs text-gray-500">{e.hook}{e.goldenHour ? ` · giờ vàng ${e.goldenHour}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand-600" /><h2 className="font-semibold text-sm">{t("Doanh số Sale")}</h2></div>
          <div className="divide-y divide-gray-100">
            {saleMetrics.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">{t("Chưa có doanh số.")}</div>}
            {saleMetrics.map((s, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className={`w-6 text-center font-bold ${RANK_CLR[i] || "text-gray-300"}`}>{i < 3 ? <Medal className="w-4 h-4 inline" /> : i + 1}</span>
                <span className="flex-1 font-medium text-gray-900 truncate">{s.name}</span>
                <span className="text-gray-700">{fmtVND(s.revenue)}</span>
                {s.pct != null && <span className={`text-xs px-1.5 py-0.5 rounded ${s.pct >= 100 ? "bg-emerald-50 text-emerald-600" : s.pct >= 70 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>{s.pct}%</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2"><Target className="w-4 h-4 text-brand-600" /><h2 className="font-semibold text-sm">{t("KPI phòng ban ·")} {cycleName}</h2></div>
          <div className="divide-y divide-gray-100">
            {kpiBoard.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">{t("Chưa có KPI trong kỳ. Gán ở trang Cơ chế thưởng.")}</div>}
            {kpiBoard.map((k, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className={`w-6 text-center font-bold ${RANK_CLR[i] || "text-gray-300"}`}>{i < 3 ? <Medal className="w-4 h-4 inline" /> : i + 1}</span>
                <span className="flex-1 font-medium text-gray-900 truncate">{k.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${k.completion >= 100 ? "bg-emerald-50 text-emerald-600" : k.completion >= 70 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>{k.completion}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /><h2 className="font-semibold text-sm">{t("Chuỗi ngày báo cáo cuối ngày (streak)")}</h2></div>
        <div className="p-4 flex flex-wrap gap-2">
          {streaks.length === 0 && <div className="text-gray-400 text-sm">{t("Chưa có chuỗi báo cáo nào.")}</div>}
          {streaks.map((s, i) => (
            <div key={i} className="rounded-lg border border-gray-200 px-3 py-2 flex items-center gap-2">
              <Flame className={`w-4 h-4 ${s.streak >= 7 ? "text-orange-500" : "text-gray-300"}`} />
              <span className="text-sm font-medium text-gray-900">{s.name}</span>
              <span className="text-sm font-bold text-orange-600">{s.streak}</span>
              <span className="text-xs text-gray-400">{t("ngày")}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
