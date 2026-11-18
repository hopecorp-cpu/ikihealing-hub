"use client";
import { ApexChart } from "@/components/ui/chart";
import { useLang } from "@/components/lang-provider";

const COLORS: Record<string, string> = { "Phạm Văn Sơn": "#2563eb", "Thu Ngân": "#16a34a", "Hoàng Thị Đào": "#db2777" };
const fmt = (n: number) => (n || 0).toLocaleString("vi") + "đ";

export default function Trend({ weekly, sales, monthly }: {
  weekly: any[]; sales: string[];
  monthly: { sale: string; rows: { month: string; avg: number | null; conv: number; revenue: number }[] }[];
}) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <div className="text-sm font-semibold mb-3">{t("Điểm tư vấn trung bình theo tuần (cải thiện không?)")}</div>
        {weekly.length < 2 ? (
          <div className="text-sm text-gray-400 py-8 text-center">{t("Cần thêm dữ liệu vài tuần để vẽ xu hướng (cron chấm hằng ngày sẽ tích luỹ).")}</div>
        ) : (
          <ApexChart type="line" height={260}
            series={sales.map(s => ({ name: s, data: weekly.map((w: any) => (w[s] ?? null)) }))}
            options={{
              colors: sales.map(s => COLORS[s] || "#888"),
              xaxis: { categories: weekly.map((w: any) => w.week) },
              yaxis: { min: 0, max: 10, labels: { formatter: (v: number) => String(Math.round(v)) } },
              markers: { size: 3, hover: { size: 5 } },
            }} />
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-x-auto">
        <div className="p-3 border-b border-gray-100 text-sm font-semibold">{t("Điểm tư vấn vs Doanh số theo tháng (theo từng sale)")}</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-3">{t("Sale")}</th><th className="text-left p-3">{t("Tháng")}</th><th className="text-right p-3">{t("Điểm TB")}</th><th className="text-right p-3">{t("Số ca chấm")}</th><th className="text-right p-3">{t("Doanh số (sổ đơn)")}</th></tr></thead>
          <tbody className="tabular-nums">
            {monthly.flatMap(m => m.rows.map((r, i) => (
              <tr key={m.sale + r.month} className="border-t border-gray-100">
                {i === 0 ? <td className="p-3 font-medium align-top" rowSpan={m.rows.length}>{m.sale}</td> : null}
                <td className="p-3">{r.month}</td>
                <td className={`p-3 text-right font-semibold ${r.avg == null ? "text-gray-300" : r.avg >= 7 ? "text-emerald-600" : r.avg >= 5 ? "text-blue-600" : "text-red-600"}`}>{r.avg == null ? "—" : r.avg}</td>
                <td className="p-3 text-right text-gray-500">{r.conv || "—"}</td>
                <td className="p-3 text-right">{r.revenue ? fmt(r.revenue) : "—"}</td>
              </tr>
            )))}
          </tbody>
        </table>
        <p className="text-[11px] text-gray-400 p-3">{t("Điểm tư vấn tăng + doanh số tăng = coaching hiệu quả. Doanh số khớp tên sale trong sổ đơn Telegram (net, đã trừ VAT).")}</p>
      </div>
    </div>
  );
}
