import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { isManagerOrAbove } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function DoanhThuSanPhamPage({ searchParams }: { searchParams: { m?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role))) redirect("/");

  const { t } = getT();
  const sb = getServiceClient();

  let month = searchParams.m;
  if (!month) {
    const { data: latest } = await sb.from("product_revenue_monthly")
      .select("month").order("month", { ascending: false }).limit(1);
    month = latest?.[0]?.month ?? vnDateStr().slice(0, 7);
  }
  let rows: any[] = [];
  let tableMissing = false;
  const { data, error } = await sb.from("product_revenue_monthly")
    .select("*").eq("month", month).order("net_revenue", { ascending: false });
  if (error) tableMissing = true; else rows = data ?? [];

  const totalNet = rows.reduce((s, r) => s + (r.net_revenue || 0), 0);
  const totalQty = rows.reduce((s, r) => s + (r.quantity || 0), 0);
  const totalTax = rows.reduce((s, r) => s + (r.tax || 0), 0);
  const pct = (n: number) => totalNet > 0 ? (n / totalNet * 100).toFixed(1) + "%" : "—";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Doanh thu theo mặt hàng")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Doanh thu net (đã trừ VAT) từng SP — nguồn MISA.")}</p>
        </div>
        <form className="flex gap-2 items-center">
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      {tableMissing ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
          {t("Chưa tạo bảng")} <code>product_revenue_monthly</code>. {t("Paste migration 020 vào Supabase → SQL Editor → Run, rồi chạy")} <code>node scripts/import-product-revenue-t5.mjs</code>.
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">{t("Chưa có dữ liệu cho tháng")} {month}.</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 uppercase">{t("Tổng DT net")}</div>
              <div className="text-lg sm:text-2xl font-bold mt-1 text-emerald-700">{fmtVND(totalNet)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 uppercase">{t("Số mặt hàng")}</div>
              <div className="text-lg sm:text-2xl font-bold mt-1">{rows.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 uppercase">{t("VAT thu hộ")}</div>
              <div className="text-lg sm:text-2xl font-bold mt-1 text-orange-600">{fmtVND(totalTax)}</div>
            </div>
          </div>

          <div className="sm:hidden space-y-2">
            {rows.map((r, i) => (
              <div key={r.id} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm leading-snug">{i + 1}. {r.product_name}</div>
                    <div className="text-[11px] text-gray-400">{r.sku} · SL {r.quantity}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-emerald-700">{fmtVND(r.net_revenue)}</div>
                    <div className="text-[11px] text-gray-400">{pct(r.net_revenue)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left p-3">#</th>
                  <th className="text-left p-3">{t("Mặt hàng")}</th>
                  <th className="text-right p-3">{t("SL")}</th>
                  <th className="text-right p-3">{t("Tiền hàng")}</th>
                  <th className="text-right p-3">{t("Khuyến mại")}</th>
                  <th className="text-right p-3">{t("Thuế")}</th>
                  <th className="text-right p-3">{t("DT net")}</th>
                  <th className="text-right p-3">{t("% DT")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-3 text-gray-400">{i + 1}</td>
                    <td className="p-3"><div className="font-medium">{r.product_name}</div><div className="text-[11px] text-gray-400">{r.sku}</div></td>
                    <td className="p-3 text-right">{r.quantity}</td>
                    <td className="p-3 text-right text-gray-600">{fmtVND(r.gross_amount)}</td>
                    <td className="p-3 text-right text-gray-500">{r.discount ? "-" + fmtVND(r.discount) : "—"}</td>
                    <td className="p-3 text-right text-orange-600">{fmtVND(r.tax)}</td>
                    <td className="p-3 text-right font-semibold text-emerald-700">{fmtVND(r.net_revenue)}</td>
                    <td className="p-3 text-right text-gray-500">{pct(r.net_revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="p-3" colSpan={2}>{t("TỔNG")}</td>
                  <td className="p-3 text-right">{totalQty}</td>
                  <td colSpan={2}></td>
                  <td className="p-3 text-right text-orange-600">{fmtVND(totalTax)}</td>
                  <td className="p-3 text-right text-emerald-700">{fmtVND(totalNet)}</td>
                  <td className="p-3 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
