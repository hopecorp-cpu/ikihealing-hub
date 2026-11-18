"use client";
import { useState, useMemo } from "react";
import { ApexChart } from "@/components/ui/chart";
import { useLang } from "@/components/lang-provider";

interface Pnl {
  month: string; label: string; revenue: number; cogs: number; salary: number;
  insurance: number; interest: number; warehouse_rent: number; other_cost: number;
  total_cost: number; profit: number; net_margin: number; cogs_ratio: number; complete: boolean; note?: string;
}
interface Exp { stt: number; date: string | null; content: string; amount: number; recipient: string }
interface Prod { sku: string; name: string; qty: number; revenue_pretax: number; revenue_vat: number; unit_cost: number; cogs: number; gross_profit: number; gp_pct: number }
interface Data {
  generatedAt: string; period: string; pnl: Pnl[];
  expenses: Record<string, Exp[]>; productRevenue: Record<string, Prod[]>; insights: string[];
}

const CATS = [
  { key: "cogs", label: "Giá vốn", color: "#ef4444" },
  { key: "salary", label: "Lương", color: "#f59e0b" },
  { key: "other_cost", label: "Chi phí khác", color: "#8b5cf6" },
  { key: "warehouse_rent", label: "Thuê kho/nhà", color: "#3b82f6" },
  { key: "interest", label: "Lãi vay", color: "#14b8a6" },
  { key: "insurance", label: "Bảo hiểm", color: "#94a3b8" },
] as const;

export default function FinanceDashboard({ data }: { data: Data }) {
  const { t, ml, locale } = useLang();
  const loc = locale === "vi" ? "vi-VN" : locale === "ja" ? "ja-JP" : "en-US";
  const trM = (n: number) => (n / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 });
  const vnd = (n: number) => Math.round(n).toLocaleString(loc) + (locale === "vi" ? "đ" : " ₫");
  const pct = (n: number) => (n * 100).toLocaleString(loc, { maximumFractionDigits: 1 }) + "%";
  const signTr = (n: number) => (n >= 0 ? "+" : "−") + trM(Math.abs(n)) + " " + t("tr");

  const { pnl, expenses, productRevenue, insights } = data;
  const months = pnl.map(p => p.month);
  const [ledgerMonth, setLedgerMonth] = useState(months[months.length - 1]);
  const [q, setQ] = useState("");

  const first = pnl[0], last = pnl[pnl.length - 1];
  const lossCount = pnl.filter(p => p.profit < 0).length;

  const ledger = expenses[ledgerMonth] || [];
  const ledgerFiltered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return ledger
      .filter(e => !kw || e.content.toLowerCase().includes(kw) || (e.recipient || "").toLowerCase().includes(kw))
      .sort((a, b) => b.amount - a.amount);
  }, [ledger, q]);
  const ledgerTotal = ledgerFiltered.reduce((s, e) => s + e.amount, 0);

  const prods = (productRevenue[months[0]] || []).slice().sort((a, b) => b.revenue_pretax - a.revenue_pretax);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{t("Tài chính · Ban điều hành & Kế toán")}</p>
        <h1 className="text-2xl font-bold text-gray-900">{t("Chi phí & Lợi nhuận")}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t("Kỳ:")} {data.period} · {t("cập nhật")} {data.generatedAt}</p>
      </div>

      {lossCount > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-700">{t("Cảnh báo: lỗ")} {lossCount} {t("tháng liên tiếp")}</p>
          <p className="text-sm text-red-600 mt-1">
            {t(last.label)} {t("lỗ")} <b>{signTr(last.profit)}</b> {t("(biên")} {pct(last.net_margin)}). {t("Cấu trúc chi phí đang vượt doanh thu — xem nhận xét & hành động bên dưới.")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {pnl.map(p => {
          const loss = p.profit < 0;
          return (
            <div key={p.month} className={`rounded-2xl border p-4 ${loss ? "border-red-200 bg-white" : "border-emerald-200 bg-white"}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800">{ml(t(p.label))}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${loss ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{loss ? t("LỖ") : t("LÃI")}</span>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <Row label={t("Doanh thu")} val={trM(p.revenue) + " " + t("tr")} />
                <Row label={t("Tổng chi phí")} val={trM(p.total_cost) + " " + t("tr")} />
                <div className="flex justify-between border-t pt-1.5">
                  <span className="text-gray-500">{t("Lợi nhuận")}</span>
                  <span className={`sensitive font-bold ${loss ? "text-red-600" : "text-emerald-600"}`}>{signTr(p.profit)}</span>
                </div>
                <Row label={t("Biên LN ròng")} val={pct(p.net_margin)} valClass={loss ? "text-red-600" : "text-emerald-600"} />
                <Row label={t("Tỷ lệ giá vốn")} val={pct(p.cogs_ratio)} />
              </div>
            </div>
          );
        })}
      </div>

      <Card title={t("Xu hướng Doanh thu · Chi phí · Lợi nhuận")} sub={t("Đơn vị: triệu VNĐ")}>
        <ApexChart type="line" height={300}
          series={[
            { name: t("Doanh thu"), type: "column", data: pnl.map(p => p.revenue) },
            { name: t("Tổng chi phí"), type: "column", data: pnl.map(p => p.total_cost) },
            { name: t("Lợi nhuận"), type: "line", data: pnl.map(p => p.profit) },
          ]}
          options={{
            colors: ["#10b981", "#f87171", "#6366f1"], stroke: { width: [0, 0, 2.5] },
            plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
            xaxis: { categories: pnl.map(p => ml(t(p.label).replace("/2026", ""))) },
            yaxis: { labels: { formatter: (v: number) => trM(v) } },
            tooltip: { y: { formatter: (v: number) => vnd(v) } },
            markers: { size: 4, hover: { size: 6 } },
          }} />
      </Card>

      <Card title={t("Cơ cấu chi phí theo tháng")} sub={t("6 nhóm chi phí · triệu VNĐ")}>
        <ApexChart type="bar" height={300}
          series={CATS.map(c => ({ name: t(c.label), data: pnl.map(p => (p as any)[c.key]) }))}
          options={{
            chart: { stacked: true }, colors: CATS.map(c => c.color),
            plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
            xaxis: { categories: pnl.map(p => ml(t(p.label).replace("/2026", ""))) },
            yaxis: { labels: { formatter: (v: number) => trM(v) } },
            tooltip: { y: { formatter: (v: number) => vnd(v) } },
          }} />
      </Card>

      <Card title={t("So sánh chi tiết khoản mục")} sub={`${t("Chênh lệch")} ${t(last.label)} vs ${t(first.label)}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-2">{t("Khoản mục")}</th>
                {pnl.map(p => <th key={p.month} className="py-2 px-2 text-right">{ml(t(p.label).replace("/2026", ""))}</th>)}
                <th className="py-2 pl-2 text-right">{t("Chênh lệch")}</th>
                <th className="py-2 pl-2 text-right">{t("% đổi")}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Doanh thu", key: "revenue", strong: true },
                ...CATS.map(c => ({ label: t(c.label), key: c.key, strong: false })),
                { label: t("TỔNG CHI PHÍ"), key: "total_cost", strong: true },
                { label: t("LỢI NHUẬN"), key: "profit", strong: true },
              ].map((row) => {
                const v0 = (first as any)[row.key], vN = (last as any)[row.key];
                const diff = vN - v0, chg = v0 ? diff / Math.abs(v0) : 0;
                const isProfit = row.key === "profit";
                return (
                  <tr key={row.key} className={`border-b last:border-0 ${row.strong ? "font-semibold" : ""}`}>
                    <td className="py-2 pr-2 text-gray-800">{t(row.label)}</td>
                    {pnl.map(p => {
                      const val = (p as any)[row.key];
                      return <td key={p.month} className={`py-2 px-2 text-right tabular-nums ${isProfit && val < 0 ? "text-red-600" : "text-gray-700"}`}>{trM(val)}</td>;
                    })}
                    <td className={`py-2 pl-2 text-right tabular-nums ${diff > 0 ? (isProfit ? "text-emerald-600" : "text-red-600") : (isProfit ? "text-red-600" : "text-emerald-600")}`}>{signTr(diff)}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-gray-500">{v0 ? pct(chg) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-gray-400 mt-2">{t("Đơn vị cột tháng: triệu VNĐ. Với nhóm chi phí, tăng = xấu (đỏ); với LN, tăng = tốt (xanh).")}</p>
        </div>
      </Card>

      <Card title={t("Nhận xét & Hành động đề xuất")}>
        <ul className="space-y-2">
          {insights.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </Card>

      {prods.length > 0 && (
        <Card title={`${t("Doanh thu theo sản phẩm")} — ${ml(t(pnl[0].label))}`} sub={`${prods.length} ${t("mặt hàng · sắp theo doanh thu")}`}>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2">{t("Sản phẩm")}</th>
                  <th className="py-2 px-2 text-right">{t("SL")}</th>
                  <th className="py-2 px-2 text-right">{t("DT (trước thuế)")}</th>
                  <th className="py-2 px-2 text-right">{t("LN gộp")}</th>
                  <th className="py-2 pl-2 text-right">{t("% LN")}</th>
                </tr>
              </thead>
              <tbody>
                {prods.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 text-gray-800">{p.name}{p.sku ? <span className="text-gray-400 text-xs"> · {p.sku}</span> : null}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{p.qty.toLocaleString(loc)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-700">{trM(p.revenue_pretax)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-700">{trM(p.gross_profit)}</td>
                    <td className={`py-1.5 pl-2 text-right tabular-nums font-medium ${p.gp_pct < 0 ? "text-red-600" : p.gp_pct > 0.5 ? "text-emerald-600" : "text-gray-600"}`}>{pct(p.gp_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 mt-2">{t("DT & LN gộp đơn vị triệu VNĐ. % LN âm = bán dưới giá vốn (cần xem lại giá).")}</p>
          </div>
        </Card>
      )}

      <Card title={t("Sổ chi tiết các khoản chi")} sub={t("Tra cứu từng giao dịch")}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {months.map(m => (
            <button key={m} onClick={() => setLedgerMonth(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${ledgerMonth === m ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {ml(t(pnl.find(p => p.month === m)?.label)?.replace("/2026", "") || m)}
            </button>
          ))}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm nội dung / người nhận…")}
            className="ml-auto px-3 py-1.5 rounded-lg border border-gray-200 text-sm w-full sm:w-64" />
        </div>
        <div className="text-xs text-gray-500 mb-2">{ledgerFiltered.length} {t("giao dịch · tổng")} <b>{vnd(ledgerTotal)}</b></div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="py-2 px-3">{t("Ngày")}</th>
                <th className="py-2 px-3">{t("Nội dung")}</th>
                <th className="py-2 px-3 hidden sm:table-cell">{t("Người nhận")}</th>
                <th className="py-2 px-3 text-right">{t("Số tiền")}</th>
              </tr>
            </thead>
            <tbody>
              {ledgerFiltered.map((e, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="py-1.5 px-3 text-gray-500 whitespace-nowrap">{e.date || "—"}</td>
                  <td className="py-1.5 px-3 text-gray-800">{e.content}</td>
                  <td className="py-1.5 px-3 text-gray-500 hidden sm:table-cell">{e.recipient || "—"}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums font-medium text-gray-800 whitespace-nowrap">{vnd(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ledgerMonth === months[0] && (
          <p className="text-[11px] text-gray-400 mt-2">{t("Lưu ý: sổ")} {ml(t(pnl[0].label))} {t("là lũy kế (gồm cả giao dịch từ trước), đã bao gồm trả nợ vay, lương — không khớp 1-1 với \"chi phí khác\" trên P&L.")}</p>
        )}
      </Card>

      <p className="text-center text-xs text-gray-400 py-4">{t("Nguồn: BÁO CÁO CHI PHÍ LỢI NHUẬN ACME.xlsx · Cập nhật tháng mới: thay file Excel rồi chạy lại import.")}</p>
    </div>
  );
}

function Row({ label, val, valClass = "text-gray-800" }: { label: string; val: string; valClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`sensitive font-medium tabular-nums ${valClass}`}>{val}</span>
    </div>
  );
}
function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm">
      <div className="mb-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
