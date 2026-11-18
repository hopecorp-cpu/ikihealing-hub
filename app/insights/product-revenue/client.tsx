"use client";
import { ApexChart } from "@/components/ui/chart";
import { fmtVND } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

type Row = {
  label: string;
  color: string;
  count: number;
  total: number;
  pct: number;
  isFallback?: boolean;
};

export function ProductRevenueClient({
  categories,
  groups,
  totalRev,
}: {
  categories: Row[];
  groups: Row[];
  totalRev: number;
}) {
  const { t } = useLang();

  const pieData = groups.map(g => ({ name: g.label, value: g.total, color: g.color, pct: g.pct }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <h3 className="font-bold mb-1">{t("Thị phần theo nhóm chiến lược")}</h3>
          <p className="text-xs text-gray-500 mb-3">{t("Gom các SP nhỏ thành nhóm lớn")}</p>
          {pieData.length === 0 ? (
            <Empty />
          ) : (
            <ApexChart type="donut" height={300}
              series={pieData.map(d => d.value)}
              options={{
                labels: pieData.map(d => d.name),
                colors: pieData.map(d => d.color),
                stroke: { width: 2, colors: ["#fff"] },
                legend: { position: "bottom", fontSize: "11px", formatter: (s: string) => (s.length > 22 ? s.slice(0, 22) + "…" : s) },
                dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%`, style: { fontSize: "11px", fontWeight: 700 }, dropShadow: { enabled: false } },
                plotOptions: { pie: { donut: { size: "58%", labels: { show: true, total: { show: true, label: t("Tổng"), formatter: () => fmtVND(pieData.reduce((s, d) => s + d.value, 0)) } } } } },
                tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
              }} />
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <h3 className="font-bold mb-1">{t("Top dòng sản phẩm (chi tiết)")}</h3>
          <p className="text-xs text-gray-500 mb-3">{t("% doanh thu mỗi dòng SP")}</p>
          <div className="space-y-2.5">
            {categories.slice(0, 10).map(c => (
              <div key={t(c.label)}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium truncate pr-2" title={t(c.label)}>
                    {t(c.label)}
                  </span>
                  <span className="text-gray-500 shrink-0 tabular-nums">
                    {c.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-5 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full rounded flex items-center justify-end pr-1.5 text-[10px] text-white font-semibold"
                    style={{
                      width: `${Math.max(c.pct, 1)}%`,
                      backgroundColor: c.color,
                      minWidth: c.pct > 8 ? "auto" : 0,
                    }}
                  >
                    {c.pct > 12 ? fmtVND(c.total) : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">{t("Nhóm sản phẩm")}</th>
              <th className="text-right px-4 py-2.5 font-semibold">{t("Số đơn")}</th>
              <th className="text-right px-4 py-2.5 font-semibold">{t("Doanh thu")}</th>
              <th className="text-right px-4 py-2.5 font-semibold">{t("Tỉ trọng")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map(c => (
              <tr key={t(c.label)} className={c.isFallback ? "bg-gray-50/60" : ""}>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    {t(c.label)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">{c.count.toLocaleString("vi-VN")}</td>
                <td className="px-4 py-2.5 text-right font-medium">{fmtVND(c.total)}</td>
                <td className="px-4 py-2.5 text-right font-semibold" style={{ color: c.color }}>
                  {c.pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-900 text-white font-bold">
            <tr>
              <td className="px-4 py-2.5">{t("TỔNG")}</td>
              <td className="px-4 py-2.5 text-right">
                {categories.reduce((s, c) => s + c.count, 0).toLocaleString("vi-VN")}
              </td>
              <td className="px-4 py-2.5 text-right">{fmtVND(totalRev)}</td>
              <td className="px-4 py-2.5 text-right">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Empty() {
  const { t } = useLang();
  return (
    <div className="text-center py-16 text-gray-400 text-sm">{t("Không có dữ liệu trong khoảng này")}</div>
  );
}
