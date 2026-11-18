"use client";
import { fmtVND } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

type MonthData = {
  month: string;
  orders: number;
  revenue: number;
  aov: number;
  newCount: number;
  returningCount: number;
  retentionPct: number;
};

export function CustomerMetricsClient({
  monthsBreakdown,
  distribution,
  topCustomers,
  totalCustomers,
  clv,
}: {
  monthsBreakdown: MonthData[];
  distribution: Record<string, number>;
  topCustomers: any[];
  totalCustomers: number;
  clv: number;
}) {
  const { t } = useLang();
  const maxOrders = Math.max(1, ...monthsBreakdown.map(m => m.orders));
  const maxRevenue = Math.max(1, ...monthsBreakdown.map(m => m.revenue));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-bold mb-3">{t("Khách mới vs Khách quay lại theo tháng")}</h3>
        {monthsBreakdown.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">{t("Không có data trong khoảng này")}</div>
        ) : (
          <div className="space-y-3">
            {monthsBreakdown.map(m => {
              const total = m.newCount + m.returningCount;
              const newPct = total > 0 ? (m.newCount / total) * 100 : 0;
              return (
                <div key={m.month}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="tabular-nums font-semibold">{m.month}</span>
                    <span className="text-gray-500">
                      {m.orders} {t("đơn")} · {fmtVND(m.revenue)}
                    </span>
                  </div>
                  <div className="h-7 bg-gray-100 rounded overflow-hidden flex">
                    <div
                      className="bg-blue-500 flex items-center justify-end px-2 text-xs text-white font-semibold"
                      style={{ width: `${newPct}%` }}
                      title={`${m.newCount} ${t("khách mới")}`}
                    >
                      {m.newCount > 0 && <>{m.newCount} {t("mới")}</>}
                    </div>
                    <div
                      className="bg-emerald-500 flex items-center justify-end px-2 text-xs text-white font-semibold"
                      style={{ width: `${100 - newPct}%` }}
                      title={`${m.returningCount} ${t("khách quay lại")}`}
                    >
                      {m.returningCount > 0 && <>{m.returningCount} {t("lại")}</>}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5 text-right">
                    {t("Retention:")} {m.retentionPct.toFixed(1)}% · AOV: {fmtVND(m.aov)}
                  </div>
                </div>
              );
            })}
            <div className="flex gap-3 text-xs pt-2 border-t border-gray-100">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-blue-500 rounded"></span> {t("Khách mới")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-emerald-500 rounded"></span> {t("Khách quay lại")}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-bold mb-3">{t("Phân phối số đơn / khách")}</h3>
        <div className="space-y-2">
          {Object.entries(distribution).map(([k, v]) => {
            const pct = totalCustomers > 0 ? (v / totalCustomers) * 100 : 0;
            const isProblem = k === "1 đơn" && pct > 70;
            const isGood = (k === "3-5 đơn" || k === "6-10 đơn" || k === "10+") && v > 0;
            return (
              <div key={k}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold">{t(k)}</span>
                  <span className={isProblem ? "text-red-600 font-bold" : isGood ? "text-emerald-600 font-semibold" : "text-gray-600"}>
                    {v} {t("khách")} ({pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-5 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${isProblem ? "bg-red-400" : isGood ? "bg-emerald-500" : "bg-blue-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-gray-500 mt-3 italic">
          {t("→ Càng nhiều khách ở nhóm \"3+ đơn\" càng tốt. Đỏ ở \"1 đơn\" = nhiều khách mua 1 lần rồi biến mất.")}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5 lg:col-span-2">
        <h3 className="font-bold mb-3">{t("Top 10 khách hàng theo doanh thu")}</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-2 w-12">#</th>
              <th className="text-left p-2">{t("Tên")}</th>
              <th className="text-left p-2">{t("SĐT")}</th>
              <th className="text-right p-2">{t("Số đơn")}</th>
              <th className="text-right p-2">{t("Doanh thu")}</th>
              <th className="text-right p-2">{t("AOV của khách")}</th>
            </tr>
          </thead>
          <tbody>
            {topCustomers.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">{t("Chưa có data")}</td></tr>
            ) : topCustomers.map((c, i) => (
              <tr key={c.id} className={`border-t border-gray-100 ${i < 3 ? "bg-amber-50/40" : ""}`}>
                <td className="p-2 font-bold text-gray-500">
                  {i === 0 && ""} {i === 1 && ""} {i === 2 && ""} {i >= 3 && `#${i + 1}`}
                </td>
                <td className="p-2 font-medium">{c.name}</td>
                <td className="p-2 text-xs text-gray-500 tabular-nums">{c.phone || "—"}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{c.orders}</td>
                <td className="p-2 text-right tabular-nums font-bold text-emerald-700">{fmtVND(c.revenue)}</td>
                <td className="p-2 text-right tabular-nums text-xs text-gray-600">{fmtVND(c.revenue / c.orders)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {topCustomers.length > 0 && (
          <div className="text-xs text-gray-500 mt-3 italic">
            {t("Top 10 khách đang đóng góp")} <b>{(topCustomers.reduce((s, c) => s + c.revenue, 0) / (totalCustomers * clv) * 100).toFixed(1)}%</b> {t("tổng doanh thu (Pareto 80/20).")}
          </div>
        )}
      </div>
    </div>
  );
}
