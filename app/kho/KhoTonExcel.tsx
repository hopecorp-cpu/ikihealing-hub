import { getT } from "@/lib/i18n-server";
import stockTinh from "@/data/warehouse-stock.json";
import {
  AS_OF_DOI_CHIEU,
  AS_OF_HIEN_HANH,
  NGUON_EXCEL_ANH,
  SO_TON_EXCEL_ANH,
  gopHaiKy,
  lechUuTien,
  thongKe,
  type DongAcme,
} from "@/lib/kho-ton-ky";

function so(n: number | null): string {
  if (n == null) return "thiếu số";
  return n.toLocaleString("vi-VN");
}

export default function KhoTonExcel() {
  const { t: t } = getT();
  const acme: DongAcme[] = (stockTinh.items || []).map((i) => ({
    sku: i.sku,
    name: i.name,
    closing: i.closing,
  }));
  const dong = gopHaiKy(SO_TON_EXCEL_ANH);
  const tk = thongKe(SO_TON_EXCEL_ANH);
  const lech = lechUuTien(SO_TON_EXCEL_ANH, acme);
  const thieu = dong.filter((d) => d.thieuKySau);

  return (
    <section className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">{t("Tồn Excel anh")}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("Nguồn")} {NGUON_EXCEL_ANH}{t(". Kỳ hiện hành as_of")} {AS_OF_HIEN_HANH}{t(". Kỳ")} {AS_OF_DOI_CHIEU} {t("chỉ đối chiếu.\n          Ô trống là thiếu số liệu, không phải 0. Không ghi giá bán, giá vốn, listing sàn. Chưa đè mốc sổ tự trừ.")}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="rounded-lg border border-gray-100 px-3 py-2"><div className="text-gray-500">SKU</div><div className="font-semibold tabular-nums">{tk.sku}</div></div>
        <div className="rounded-lg border border-gray-100 px-3 py-2"><div className="text-gray-500">{t("Có số 26/09")}</div><div className="font-semibold tabular-nums">{tk.coSo}</div></div>
        <div className="rounded-lg border border-gray-100 px-3 py-2"><div className="text-gray-500">{t("Thiếu số 26/09")}</div><div className="font-semibold tabular-nums">{tk.thieu}</div></div>
        <div className="rounded-lg border border-gray-100 px-3 py-2"><div className="text-gray-500">{t("Tồn 0")}</div><div className="font-semibold tabular-nums">{tk.bangKhong}</div></div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 text-sm text-amber-950">
        <div className="font-semibold">{t("Đối chiếu Đạm, Beauty Meal, Trà Mẫu A, Trà Mẫu B")}</div>
        {lech.map((d) => (
          <div key={d.sku}>
            <div className="font-semibold">{d.sku} · {d.name || t("không thấy mã")} · {d.unit}</div>
            <div className="tabular-nums">05/09: {so(d.cuoi0509)} · 26/09: {so(d.cuoi2609)}</div>
            {d.lech.map((l) => <div key={l}>{l}</div>)}
          </div>
        ))}
        {thieu.length > 0 && (
          <div>{t("Thiếu số 26/09 (")}{thieu.length}): {thieu.map((d) => d.sku).join(", ")}.</div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left p-2">{t("Mã")}</th>
              <th className="text-left p-2">{t("Tên hàng")}</th>
              <th className="text-left p-2">{t("ĐVT")}</th>
              <th className="text-right p-2">{t("Cuối 05/09")}</th>
              <th className="text-right p-2">{t("Cuối 26/09")}</th>
            </tr>
          </thead>
          <tbody>
            {dong.map((d) => (
              <tr key={d.sku} className={`border-t border-gray-100 ${d.thieuKySau ? "bg-amber-50" : ""}`}>
                <td className="p-2 text-xs">{d.sku}</td>
                <td className="p-2 font-medium max-w-[320px]">{d.name}</td>
                <td className="p-2 text-xs text-gray-500">{d.lechDonVi ? `${d.unit} (lệch ĐVT)` : d.unit}</td>
                <td className={`p-2 text-right tabular-nums ${d.cuoi0509 == null ? "text-amber-700" : "text-gray-500"}`}>{so(d.cuoi0509)}</td>
                <td className={`p-2 text-right tabular-nums font-semibold ${d.cuoi2609 == null ? "text-amber-700" : "text-gray-900"}`}>{so(d.cuoi2609)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
