import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { FINANCE_WHITELIST } from "@/lib/auth";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { tuoiNguonDon } from "@/lib/doanh-thu";
import { analyzeKm, fmtKmVND, type LineRow } from "@/lib/km-analysis";
import { Tag, AlertTriangle, Gift } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Phân tích khuyến mãi | ACME Ops Hub") };
}

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const email = (user.email || "").toLowerCase().trim();
  if (!(user.role === "ceo" || user.role === "admin" || FINANCE_WHITELIST.includes(email))) redirect("/?denied=phan-tich-km");

  const sb = getServiceClient();
  const today = vnDateStr();
  const from = new Date(today + "T00:00:00"); from.setMonth(from.getMonth() - 6);
  const fromISO = from.toISOString().slice(0, 10);

  const tuoi = await tuoiNguonDon(sb);
  const { data } = await sb.from("mshopkeeper_line_items")
    .select("order_date, gross_amount, discount, net_amount, cost_amount, profit_amount, sale_channel, product_name")
    .gte("order_date", fromISO)
    .range(0, 49999);
  const rows = (data ?? []) as LineRow[];
  const rep = analyzeKm(rows, 30);

  const rateCls = (r: number) => r >= 25 ? "text-red-600" : r >= 15 ? "text-amber-600" : "text-gray-700";
  const marginCls = (m: number) => m < 0 ? "text-red-700 font-bold" : m === 0 ? "text-gray-400" : m < 30 ? "text-red-600" : m < 50 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="w-6 h-6 text-brand-600" /> {t("Phân tích khuyến mãi")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Từ dữ liệu MISA (6 tháng gần nhất). Tỉ lệ giảm & biên gộp là số dẫn xuất —")} <b>{t("không lộ giá vốn")}</b>.</p>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <b>{t("Số này CHỈ THAM KHẢO.")}</b> {t("MISA không còn là nguồn bán hàng từ 01/08/2026 (số bán hàng đã sang sổ đơn Telegram), nhưng chiết khấu và giá vốn theo dòng hàng hiện chỉ MISA có nên trang này vẫn đọc MISA — dữ liệu dừng ở")} <b>{tuoi.misaToi || "?"}</b>{tuoi.misaTre != null ? ` (${tuoi.misaTre} ngày trước)` : ""}{t(". Muốn có số mới phải dựng giá vốn từ bảng sản phẩm khớp sổ đơn (việc chờ CEO chốt).")}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400">{t("Chưa có dữ liệu line-item MISA trong 6 tháng.")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4"><div className="text-xs text-gray-500">{t("Doanh số gộp")}</div><div className="text-lg font-bold">{fmtKmVND(rep.overall.gross)}</div></div>
            <div className="bg-white border border-gray-200 rounded-xl p-4"><div className="text-xs text-gray-500">{t("Tổng giảm giá")}</div><div className="text-lg font-bold text-red-600">{fmtKmVND(rep.overall.discount)}</div></div>
            <div className="bg-white border border-gray-200 rounded-xl p-4"><div className="text-xs text-gray-500">{t("Tỉ lệ giảm TB")}</div><div className={`text-lg font-bold ${rateCls(rep.overall.discountRate)}`}>{rep.overall.discountRate}%</div></div>
            <div className="bg-white border border-gray-200 rounded-xl p-4"><div className="text-xs text-gray-500">{t("Biên gộp TB")}</div><div className={`text-lg font-bold ${marginCls(rep.overall.marginPct)}`}>{rep.overall.marginPct}%</div></div>
          </div>

          {rep.flags.length > 0 && (
            <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-red-100 bg-red-50 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" /><h2 className="font-semibold text-sm text-red-800">{t("Cảnh báo phá giá / ăn mòn biên (")}{rep.flags.length})</h2></div>
              <div className="divide-y divide-gray-100">
                {rep.flags.map((f, i) => (
                  <div key={i} className="px-4 py-2.5 flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex-1 min-w-[160px] font-medium text-gray-900">{f.product}</span>
                    <span className={`${rateCls(f.discountRate)}`}>{t("giảm")} {f.discountRate}%</span>
                    <span className={`${marginCls(f.marginPct)}`}>{t("biên")} {f.marginPct}%</span>
                    <span className="text-xs text-gray-400">{f.reason}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2 text-sm text-emerald-800">
                <Gift className="w-4 h-4 shrink-0" /> {t("Khuyến nghị: chuyển từ giảm % sang")} <b>{t("tặng quà giá vốn thấp + 1 giá niêm yết")}</b> {t("để giữ biên (bám luật TP bổ sung).")}
              </div>
            </div>
          )}

          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h2 className="font-semibold text-sm">{t("Theo tháng")}</h2></div>
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-3">{t("Tháng")}</th><th className="text-right p-3">{t("Doanh số")}</th><th className="text-right p-3">{t("Giảm giá")}</th><th className="text-right p-3">{t("Tỉ lệ giảm")}</th><th className="text-right p-3">{t("Biên")}</th></tr></thead>
              <tbody>{rep.byMonth.map(m => (
                <tr key={m.key} className="border-t border-gray-100"><td className="p-3 font-medium">{m.key}</td><td className="p-3 text-right">{fmtKmVND(m.gross)}</td><td className="p-3 text-right text-red-600">{fmtKmVND(m.discount)}</td><td className={`p-3 text-right font-medium ${rateCls(m.discountRate)}`}>{m.discountRate}%</td><td className={`p-3 text-right ${marginCls(m.marginPct)}`}>{m.marginPct}%</td></tr>
              ))}</tbody>
            </table></div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h2 className="font-semibold text-sm">{t("Theo kênh bán")}</h2></div>
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-3">{t("Kênh")}</th><th className="text-right p-3">{t("Doanh số")}</th><th className="text-right p-3">{t("Giảm giá")}</th><th className="text-right p-3">{t("Tỉ lệ giảm")}</th><th className="text-right p-3">{t("Biên")}</th></tr></thead>
              <tbody>{rep.byChannel.map(c => (
                <tr key={c.key} className="border-t border-gray-100"><td className="p-3 font-medium">{c.key}</td><td className="p-3 text-right">{fmtKmVND(c.gross)}</td><td className="p-3 text-right text-red-600">{fmtKmVND(c.discount)}</td><td className={`p-3 text-right font-medium ${rateCls(c.discountRate)}`}>{c.discountRate}%</td><td className={`p-3 text-right ${marginCls(c.marginPct)}`}>{c.marginPct}%</td></tr>
              ))}</tbody>
            </table></div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h2 className="font-semibold text-sm">{t("Top sản phẩm giảm giá nhiều nhất")}</h2></div>
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-3">{t("Sản phẩm")}</th><th className="text-right p-3">{t("Giảm giá")}</th><th className="text-right p-3">{t("Tỉ lệ giảm")}</th><th className="text-right p-3">{t("Biên")}</th></tr></thead>
              <tbody>{rep.byProduct.map(p => (
                <tr key={p.key} className="border-t border-gray-100"><td className="p-3">{p.key}</td><td className="p-3 text-right text-red-600">{fmtKmVND(p.discount)}</td><td className={`p-3 text-right font-medium ${rateCls(p.discountRate)}`}>{p.discountRate}%</td><td className={`p-3 text-right ${marginCls(p.marginPct)}`}>{p.marginPct}%</td></tr>
              ))}</tbody>
            </table></div>
          </section>
        </>
      )}
    </div>
  );
}
