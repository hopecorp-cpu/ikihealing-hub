"use client";
import { useState } from "react";
import { ApexChart } from "@/components/ui/chart";
import { useLang } from "@/components/lang-provider";

const PIE = ["#10B981", "#1877F2", "#F59E0B", "#8B5CF6", "#EC4899", "#6B7280"];
const NEG_POS = { ranges: [{ from: -1e15, to: -0.0001, color: "#EF4444" }, { from: 0, to: 1e15, color: "#10B981" }] };
const TABS = [
  { k: "tongquan", label: "Tổng quan + KQKD" },
  { k: "taichinh", label: "Hiệu quả tài chính" },
  { k: "startup", label: "Sức khoẻ & Dự báo" },
  { k: "kenh", label: "Kênh / Phễu / SP" },
];

export default function ExecDashboard({ data }: { data: any }) {
  const [tab, setTab] = useState("tongquan");
  const { t, money, locale } = useLang();
  const fmtVND = money;
  const axM = (n: number) => Math.round((Number(n) || 0) / 1e6) + t("tr");
  const mtick = (v: any) => (locale === "vi" ? v : String(v).replace(/^T/, "M"));
  const d = data;
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Bảng điều hành ACME")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Chỉ số điều hành công ty — doanh thu · lợi nhuận · hiệu quả tài chính · sức khoẻ startup · kênh & phễu. (Chỉ số dành cho công ty tư nhân, không phải cổ phiếu.)")}</p>
      </div>
      <div className="inline-flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(tb => (
          <button key={tb.k} onClick={() => setTab(tb.k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${tab === tb.k ? "bg-white shadow-sm text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}>{t(tb.label)}</button>
        ))}
      </div>

      {tab === "tongquan" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={t("DT luỹ kế 2026")} value={fmtVND(d.ytd)} color="#10B981" hint={`${t("mục tiêu")} ${fmtVND(d.annual)} · ${Math.round(d.ytd / d.annual * 100)}%`} />
            <Stat label={t("Tiền mặt hiện tại")} value={d.cash > 0 ? fmtVND(d.cash) : "—"} color="#6366F1" hint={d.banks.map((b: any) => b.name).join(" + ")} />
            <Stat label={t("Dòng tiền TB/tháng (3T)")} value={(d.avgNet >= 0 ? "+" : "") + fmtVND(d.avgNet)} color={d.avgNet >= 0 ? "#10B981" : "#EF4444"} />
            <Stat label={t("Runway")} value={d.runwayMonths != null ? `${d.runwayMonths.toFixed(1)} ${t("tháng")}` : (d.avgNet >= 0 ? t("Dương ") : "—")} color={d.runwayMonths != null && d.runwayMonths < 6 ? "#EF4444" : "#10B981"} />
          </div>
          {d.gift && (d.gift.value > 0 || d.gift.cost > 0) && (
            <Card title={t("Quà tặng / khuyến mại (luỹ kế)")}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label={t("Chi phí quà (giá vốn)")} value={d.gift.cost > 0 ? fmtVND(d.gift.cost) : "—"} color="#EF4444" hint={d.gift.cost > 0 ? `${Math.round(d.gift.cost / Math.max(1, d.ytd) * 1000) / 10}% ${t("DT")}` : t("MISA chưa nhập giá vốn")} />
                <Stat label={t("Giá trị niêm yết")} value={fmtVND(d.gift.value)} color="#6366F1" />
                <Stat label={t("Đơn có quà")} value={String(d.gift.orders)} color="#10B981" />
                <Stat label={t("Khách được tặng")} value={String(d.gift.custs)} color="#8B5CF6" />
              </div>
              <p className="text-[11px] text-gray-400 mt-2">{t("Quà = dòng bán 0đ kèm đơn (nguồn MISA). Chi phí = giá vốn các dòng này.")}</p>
            </Card>
          )}
          <Card title={t("Doanh thu theo tháng 2026")}>
            <ApexChart type="bar" height={260}
              series={[{ name: t("Doanh thu"), data: d.revRows.map((r: any) => r.rev) }]}
              options={{
                colors: ["#10B981"], plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
                xaxis: { categories: d.revRows.map((r: any) => mtick(t(r.label))) },
                yaxis: { labels: { formatter: axM } }, tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
              }} />
          </Card>
          <Card title={t("Kết quả kinh doanh (Doanh thu · Chi phí · Lợi nhuận) — T3→T5")}>
            <ApexChart type="line" height={280}
              series={[
                { name: t("Doanh thu"), type: "column", data: d.pnlRows.map((r: any) => r.revenue) },
                { name: t("Chi phí"), type: "column", data: d.pnlRows.map((r: any) => r.cost) },
                { name: t("Lợi nhuận"), type: "line", data: d.pnlRows.map((r: any) => r.profit) },
              ]}
              options={{
                colors: ["#34D399", "#F87171", "#6366F1"], stroke: { width: [0, 0, 2.5] },
                plotOptions: { bar: { borderRadius: 3, columnWidth: "60%" } },
                xaxis: { categories: d.pnlRows.map((r: any) => mtick(t(r.label))) },
                yaxis: { labels: { formatter: axM } },
                annotations: { yaxis: [{ y: 0, borderColor: "#9CA3AF" }] },
                tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
              }} />
          </Card>
          {d.netByM.length > 0 && (
            <Card title={t("Dòng tiền ngân hàng ròng theo tháng")}>
              <ApexChart type="bar" height={220}
                series={[{ name: t("Dòng tiền ròng"), data: d.netByM.map((r: any) => r.net) }]}
                options={{
                  plotOptions: { bar: { borderRadius: 4, columnWidth: "55%", colors: NEG_POS } },
                  xaxis: { categories: d.netByM.map((r: any) => mtick(t(r.label))) },
                  yaxis: { labels: { formatter: axM } }, tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
                }} />
            </Card>
          )}
        </div>
      )}

      {tab === "taichinh" && (
        <div className="space-y-4">
          {(() => { const last = d.ratioRows[d.ratioRows.length - 1] || {}; return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label={t("Biên LN ròng (ROS)")} value={(last.ros ?? "—") + "%"} color={last.ros >= 0 ? "#10B981" : "#EF4444"} hint={t(last.label)} />
                <Stat label="ROA" value={last.roa != null ? last.roa + "%" : t("cần số cân đối")} color="#0EA5E9" />
                <Stat label="ROE" value={last.roe != null ? last.roe + "%" : t("cần số cân đối")} color="#8B5CF6" />
                <Stat label="DuPont" value={last.roe != null ? `${last.ros}%×${last.assetTurn}×${last.leverage}` : "—"} color="#F59E0B" hint={t("ROS × vòng quay × đòn bẩy = ROE")} />
              </div>
              <Card title={t("Xu hướng ROS / ROA / ROE (%)")}>
                <ApexChart type="line" height={260}
                  series={[
                    { name: "ROS", data: d.ratioRows.map((r: any) => r.ros ?? null) },
                    { name: "ROA", data: d.ratioRows.map((r: any) => r.roa ?? null) },
                    { name: "ROE", data: d.ratioRows.map((r: any) => r.roe ?? null) },
                  ]}
                  options={{
                    colors: ["#10B981", "#0EA5E9", "#8B5CF6"],
                    xaxis: { categories: d.ratioRows.map((r: any) => mtick(t(r.label))) },
                    yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}%` } },
                    annotations: { yaxis: [{ y: 0, borderColor: "#9CA3AF" }] },
                    tooltip: { y: { formatter: (v: number) => `${v}%` } }, markers: { size: 3, hover: { size: 5 } },
                  }} />
              </Card>
              <Card title={t("Lợi nhuận theo tháng")}>
                <ApexChart type="bar" height={220}
                  series={[{ name: t("Lợi nhuận"), data: d.ratioRows.map((r: any) => r.profit) }]}
                  options={{
                    plotOptions: { bar: { borderRadius: 4, columnWidth: "55%", colors: NEG_POS } },
                    xaxis: { categories: d.ratioRows.map((r: any) => mtick(t(r.label))) },
                    yaxis: { labels: { formatter: axM } }, tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
                  }} />
              </Card>
              {last.roe == null && <p className="text-xs text-amber-600">{t("Chưa có số cân đối kế toán (tài sản/vốn) để tính ROA/ROE — nhập ở /tai-chinh để hiện đầy đủ.")}</p>}
            </>
          ); })()}
        </div>
      )}

      {tab === "startup" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={t("Tỉ lệ mua lại")} value={(d.retention.repeatRate ?? 0) + "%"} color={(d.retention.repeatRate || 0) >= 30 ? "#10B981" : (d.retention.repeatRate || 0) >= 15 ? "#F59E0B" : "#EF4444"} hint={`${d.retention.totalCust || 0} ${t("khách")}`} />
            <Stat label={t("% DT khách cũ")} value={(d.retention.retRevPct ?? 0) + "%"} color="#0EA5E9" />
            <Stat label="AOV" value={fmtVND(d.retention.aov || 0)} color="#8B5CF6" />
            <Stat label="LTV / CAC" value={d.retention.ltvCac != null ? d.retention.ltvCac.toFixed(1) + "x" : "—"} color={(d.retention.ltvCac || 0) >= 3 ? "#10B981" : "#EF4444"} hint={t("lành mạnh ≥ 3x")} />
          </div>
          <Card title={t("Dự báo doanh thu cuối năm vs mục tiêu")}>
            <ApexChart type="bar" height={260}
              series={[{ name: t("Dự báo"), data: d.scenarios.map((s: any) => s.value) }]}
              options={{
                colors: PIE, plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 4, barHeight: "60%" } },
                legend: { show: false }, dataLabels: { enabled: false },
                xaxis: { categories: d.scenarios.map((s: any) => t(s.name)), labels: { formatter: axM } },
                annotations: { xaxis: [{ x: d.annual, borderColor: "#EF4444", strokeDashArray: 4, label: { text: t("Mục tiêu"), style: { fontSize: "11px", color: "#fff", background: "#EF4444" } } }] },
                tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
              }} />
            <div className="flex flex-wrap gap-2 mt-2">
              {d.scenarios.map((s: any, i: number) => <span key={i} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: PIE[i] + "1A", color: PIE[i] }}>{t(s.name)}: <b className="sensitive">{fmtVND(s.value)}</b> ({s.pct}%)</span>)}
            </div>
          </Card>
          <p className="text-xs text-gray-400">{t("LTV/CAC ≥ 3 = tăng trưởng có lãi. Thực phẩm bổ sung sống bằng mua lại — tỉ lệ mua lại thấp = đang đổ khách vào \"xô thủng\".")}</p>
        </div>
      )}

      {tab === "kenh" && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card title={t("Doanh thu theo kênh")}>
              <ApexChart type="donut" height={250}
                series={d.channelMix.map((c: any) => c.rev)}
                options={{
                  labels: d.channelMix.map((c: any) => c.name), colors: PIE,
                  legend: { position: "bottom", fontSize: "11px" }, stroke: { width: 2, colors: ["#fff"] },
                  plotOptions: { pie: { donut: { size: "58%" } } },
                  tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
                }} />
            </Card>
            <Card title={t("Top 6 sản phẩm theo doanh thu")}>
              <ApexChart type="bar" height={250}
                series={[{ name: t("Doanh thu"), data: d.productMix.map((p: any) => p.rev) }]}
                options={{
                  colors: ["#10B981"], plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "65%" } },
                  xaxis: { categories: d.productMix.map((p: any) => p.name), labels: { formatter: axM } },
                  tooltip: { y: { formatter: (v: number) => fmtVND(v) } },
                }} />
            </Card>
          </div>
          <Card title={t("Phễu chuyển đổi (ước tính)")}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Funnel label={t("Đã tư vấn (chat)")} value={d.funnel.chatChamSoc} color="#0EA5E9" />
              <Funnel label={t("Khách đã mua")} value={d.funnel.chot} color="#10B981" />
              <Funnel label={t("Tỉ lệ chốt")} value={d.funnel.chatChamSoc ? Math.round(d.funnel.chot / d.funnel.chatChamSoc * 100) + "%" : "—"} color="#F59E0B" />
            </div>
            <p className="text-[11px] text-gray-400 mt-2">{t("Tư vấn = số hội thoại chat đã chấm; khách mua = khách có đơn MISA. Phễu chi tiết theo kênh/chiến dịch ở /pheu-chien-dich.")}</p>
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: any }) {
  return <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4"><h2 className="font-bold mb-3 text-sm">{title}</h2>{children}</section>;
}
function Stat({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3"><div className="text-xs text-gray-500">{label}</div><div className="sensitive text-lg font-bold truncate" style={{ color }}>{value}</div>{hint && <div className="sensitive text-[11px] text-gray-400 truncate">{hint}</div>}</div>;
}
function Funnel({ label, value, color }: { label: string; value: any; color: string }) {
  return <div className="bg-gray-50 border border-gray-100 rounded-xl p-3"><div className="text-2xl font-bold" style={{ color }}>{value}</div><div className="text-xs text-gray-500 mt-1">{label}</div></div>;
}
