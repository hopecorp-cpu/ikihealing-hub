"use client";
import { ApexChart, fmtShort, fmtVND, ACME_PALETTE } from "@/components/ui/chart";
import { BarChart3, PieChart as PieIcon, TrendingUp, Target as TargetIcon, Award } from "lucide-react";
import { useLang } from "@/components/lang-provider";

const COLORS = ["#1E40AF", "#3B82F6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export function ExecutiveCharts({ dailySeries, channels, target }: any) {
  const { t } = useLang();
  const cats = dailySeries.map((d: any) => String(d.date).slice(5));
  const targetLine = dailySeries.map((_: any, i: number) => (target / dailySeries.length) * (i + 1));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 lg:col-span-2">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2"><TargetIcon className="w-4 h-4 text-emerald-600" /> {t("DT cộng dồn vs Target")}</h3>
        {dailySeries.length === 0 ? <Empty /> : (
          <ApexChart type="line" height={280}
            series={[
              { name: t("DT cộng dồn"), type: "area", data: dailySeries.map((d: any) => d.cumRevenue) },
              { name: t("Target line (linear)"), type: "line", data: targetLine },
            ]}
            options={{
              colors: ["#10B981", "#EF4444"],
              stroke: { curve: "smooth", width: [2.5, 2], dashArray: [0, 5] },
              fill: { type: ["gradient", "solid"], gradient: { shadeIntensity: 0.4, opacityFrom: 0.35, opacityTo: 0.05 } },
              xaxis: { categories: cats },
              yaxis: { labels: { formatter: (v: number) => fmtShort(v) } },
              tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
              markers: { size: 0, hover: { size: 5 } },
            }} />
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2"><PieIcon className="w-4 h-4 text-blue-600" /> {t("Phân bổ theo Kênh")}</h3>
        {channels.length === 0 ? <Empty /> : (
          <ApexChart type="donut" height={220}
            series={channels.map((c: any) => c.revenue)}
            options={{
              labels: channels.map((c: any) => c.name), colors: COLORS,
              legend: { show: false }, stroke: { width: 2, colors: ["#fff"] },
              plotOptions: { pie: { donut: { size: "62%" } } },
              tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
            }} />
        )}
        <div className="space-y-1 mt-1 text-xs max-h-24 overflow-y-auto">
          {channels.slice(0, 5).map((c: any, i: number) => (
            <div key={c.name} className="flex justify-between">
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: COLORS[i % COLORS.length] }} />{c.name}</span>
              <span className="tabular-nums">{fmtShort(c.revenue)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RevenueCharts({ d }: any) {
  const { t } = useLang();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold mb-1">{t("Số loại SP/Kênh")}</h3>
          {d.channels.length === 0 ? <Empty /> : (
            <ApexChart type="donut" height={220}
              series={d.channels.map((c: any) => c.count)}
              options={{
                labels: d.channels.map((c: any) => c.name), colors: COLORS,
                legend: { position: "bottom", fontSize: "10px" }, stroke: { width: 2, colors: ["#fff"] },
                dataLabels: { enabled: true, formatter: (v: number) => `${Math.round(v)}%` },
                plotOptions: { pie: { donut: { size: "55%" } } },
              }} />
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 lg:col-span-2">
          <h3 className="text-sm font-bold mb-1">{t("Doanh thu theo Quý")}</h3>
          {d.quarterSeries.length === 0 ? <Empty /> : (
            <ApexChart type="area" height={220}
              series={[{ name: t("Doanh thu"), data: d.quarterSeries.map((q: any) => q.revenue) }]}
              options={{
                colors: ["#3B82F6"],
                fill: { type: "gradient", gradient: { opacityFrom: 0.3, opacityTo: 0.03 } },
                xaxis: { categories: d.quarterSeries.map((q: any) => q.period) },
                yaxis: { labels: { formatter: (v: number) => fmtShort(v) } },
                tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
              }} />
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-bold mb-1">{t("Doanh thu TB & Chiết khấu TB theo Sub-channel")}</h3>
        {d.subChannels.length === 0 ? <Empty /> : (
          <ApexChart type="line" height={320}
            series={[
              { name: t("Avg Final Revenue"), type: "column", data: d.subChannels.map((s: any) => Math.round(s.avgRevenue)) },
              { name: t("Avg Discount"), type: "line", data: d.subChannels.map((s: any) => Math.round(s.avgDiscount)) },
            ]}
            options={{
              colors: ["#3B82F6", "#F97316"],
              stroke: { width: [0, 2.5] },
              plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
              dataLabels: { enabled: true, enabledOnSeries: [0], formatter: (v: number) => fmtShort(v), style: { fontSize: "9px" } },
              xaxis: { categories: d.subChannels.map((s: any) => s.name) },
              yaxis: [{ labels: { formatter: (v: number) => fmtShort(v) } }, { opposite: true, labels: { formatter: (v: number) => fmtShort(v) } }],
              tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
            }} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold mb-1 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" /> {t("DT theo ngày")}</h3>
          {d.dailySeries.length === 0 ? <Empty /> : (
            <ApexChart type="area" height={240}
              series={[{ name: t("Doanh thu"), data: d.dailySeries.map((x: any) => x.revenue) }]}
              options={{
                colors: ["#10B981"], fill: { type: "gradient", gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
                xaxis: { categories: d.dailySeries.map((x: any) => String(x.date).slice(5)) },
                yaxis: { labels: { formatter: (v: number) => fmtShort(v) } },
                tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
              }} />
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold mb-1 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-600" /> {t("Top sản phẩm")}</h3>
          {d.topProducts.length === 0 ? <Empty /> : (
            <ApexChart type="bar" height={240}
              series={[{ name: t("Doanh thu"), data: d.topProducts.map((p: any) => p.revenue) }]}
              options={{
                colors: ["#8B5CF6"],
                plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "70%" } },
                xaxis: { categories: d.topProducts.map((p: any) => p.name), labels: { formatter: (v: number) => fmtShort(v) } },
                tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
              }} />
          )}
        </div>
      </div>
    </div>
  );
}

export function ProfitCharts({ d }: any) {
  const { t } = useLang();
  const channelROI = d.channels.map((c: any) => ({ name: c.name, revenue: c.revenue, estProfit: c.revenue * (d.marginPct / 100) })).sort((a: any, b: any) => b.estProfit - a.estProfit);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2"><Award className="w-4 h-4 text-emerald-600" /> {t("Profit theo Kênh (ước tính)")}</h3>
        {channelROI.length === 0 ? <Empty /> : (
          <ApexChart type="bar" height={250}
            series={[
              { name: t("Doanh thu"), data: channelROI.map((c: any) => Math.round(c.revenue)) },
              { name: t("Lợi nhuận ước tính"), data: channelROI.map((c: any) => Math.round(c.estProfit)) },
            ]}
            options={{
              colors: ["#3B82F6", "#10B981"],
              plotOptions: { bar: { borderRadius: 4, columnWidth: "60%" } },
              xaxis: { categories: channelROI.map((c: any) => c.name) },
              yaxis: { labels: { formatter: (v: number) => fmtShort(v) } },
              tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
            }} />
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-600" /> {t("Discount Impact theo Sub-channel")}</h3>
        {d.subChannels.length === 0 ? <Empty /> : (
          <ApexChart type="bar" height={250}
            series={[
              { name: t("DT"), data: d.subChannels.map((s: any) => Math.round(s.revenue)) },
              { name: "Discount", data: d.subChannels.map((s: any) => Math.round(s.totalDiscount)) },
            ]}
            options={{
              colors: ["#3B82F6", "#F97316"],
              plotOptions: { bar: { borderRadius: 4, columnWidth: "60%" } },
              xaxis: { categories: d.subChannels.map((s: any) => s.name) },
              yaxis: { labels: { formatter: (v: number) => fmtShort(v) } },
              tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
            }} />
        )}
      </div>
    </div>
  );
}

export function OpsCharts({ d }: any) {
  const { t } = useLang();
  const top = d.topSales.slice(0, 10);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h3 className="text-sm font-bold mb-2">{t("Doanh thu theo Sale (ranked)")}</h3>
        {top.length === 0 ? <Empty /> : (
          <ApexChart type="bar" height={280}
            series={[{ name: t("Doanh thu"), data: top.map((s: any) => Math.round(s.revenue)) }]}
            options={{
              colors: ["#F59E0B"],
              plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "65%" } },
              xaxis: { categories: top.map((s: any) => s.name), labels: { formatter: (v: number) => fmtShort(v) } },
              tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
              annotations: { xaxis: [{ x: d.targets.saleIndividualTarget, borderColor: "#EF4444", strokeDashArray: 5, label: { text: t("Target 100M"), style: { fontSize: "10px", color: "#fff", background: "#EF4444" } } }] },
            }} />
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h3 className="text-sm font-bold mb-2">{t("Số đơn theo ngày")}</h3>
        {d.dailySeries.length === 0 ? <Empty /> : (
          <ApexChart type="bar" height={280}
            series={[{ name: t("Số đơn"), data: d.dailySeries.map((x: any) => x.orders) }]}
            options={{
              colors: ["#06B6D4"],
              plotOptions: { bar: { borderRadius: 4, columnWidth: "60%" } },
              xaxis: { categories: d.dailySeries.map((x: any) => String(x.date).slice(5)) },
              yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) } },
            }} />
        )}
      </div>
    </div>
  );
}

export function CustomersCharts({ d }: any) {
  const { t } = useLang();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h3 className="text-sm font-bold mb-2">{t("KH Mới vs Quay lại")}</h3>
        {d.customerCount === 0 ? <Empty /> : (
          <ApexChart type="donut" height={250}
            series={[d.newCustomers, d.returningCustomers]}
            options={{
              labels: [t("KH Mới"), t("KH Quay lại")], colors: ["#10B981", "#3B82F6"],
              legend: { position: "bottom" }, stroke: { width: 2, colors: ["#fff"] },
              dataLabels: { enabled: true, formatter: (v: number) => `${Math.round(v)}%` },
              plotOptions: { pie: { donut: { size: "60%" } } },
            }} />
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h3 className="text-sm font-bold mb-2">{t("Top KH theo doanh thu")}</h3>
        <div className="text-center py-12 text-gray-400 text-sm">{t("Cần build top customer leaderboard")}</div>
      </div>
    </div>
  );
}

function Empty() {
  const { t } = useLang();
  return <div className="text-center py-8 text-gray-400 text-sm"><BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" /> {t("Chưa có data")}</div>;
}
