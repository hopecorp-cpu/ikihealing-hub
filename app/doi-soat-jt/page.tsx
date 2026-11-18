import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import JtClient from "./JtClient";
import { getT } from "@/lib/i18n-server";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { Stat } from "@/components/stat";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Đối soát J&T | IKIHEALING Hub") };
}

export default async function JtPage({ searchParams }: { searchParams: { m?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=jt");

  const sb = getServiceClient();
  const month = searchParams.m || vnDateStr().slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const from = `${month}-01`, to = `${month}-${String(dim).padStart(2, "0")}`;

  let wb: any[] = [], off = 0;
  while (true) {
    const { data } = await sb.from("jt_waybills")
      .select("waybill_no,status_name,status_group,receiver_name,receiver_phone,receiver_address,goods_name,cod_value,real_cod_value,freight,order_create_time")
      .gte("order_create_time", from + " 00:00:00").lte("order_create_time", to + " 23:59:59")
      .order("order_create_time", { ascending: false }).range(off, off + 999);
    if (!data || !data.length) break; wb = wb.concat(data); if (data.length < 1000) break; off += 1000;
  }

  const prev = new Date(+month.slice(0, 4), +month.slice(5, 7) - 2, 1);
  const next = new Date(+month.slice(0, 4), +month.slice(5, 7), 1);
  const wideFrom = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;
  const wideTo = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-28`;

  const li = (await layDoanhThuNhieuThang(sb, wideFrom, wideTo)).rows;
  const inMonth = li.filter((r) => String(r.order_date || "") >= from && String(r.order_date || "") <= to);
  const mshopOrders = new Set(inMonth.map(r => r.order_code)).size;

  const normPhone = (p: any) => {
    let s = String(p || "").replace(/\D/g, "");
    if (s.startsWith("84")) s = "0" + s.slice(2);
    if (s.length === 9 && !s.startsWith("0")) s = "0" + s;
    return s;
  };
  const mshopPhones = new Set(li.map(r => normPhone(r.customer_phone)).filter(Boolean));
  const orphans = wb
    .filter(w => w.status_group === "delivered" && !mshopPhones.has(normPhone(w.receiver_phone)))
    .sort((a, b) => (Number(b.cod_value) || 0) - (Number(a.cod_value) || 0));
  const orphanCod = orphans.reduce((s, w) => s + (Number(w.cod_value) || 0), 0);
  const orphanFree = orphans.filter(w => !(Number(w.cod_value) > 0)).length;

  const g = (grp: string) => wb.filter(w => w.status_group === grp);
  const cnt = { delivered: g("delivered").length, returned: g("returned").length, cancelled: g("cancelled").length, transit: g("transit").length, other: g("other").length };
  const total = wb.length;
  const codCollected = g("delivered").reduce((s, w) => s + (Number(w.real_cod_value) || Number(w.cod_value) || 0), 0);
  const codPending = g("transit").reduce((s, w) => s + (Number(w.cod_value) || 0), 0);
  const codReturned = g("returned").reduce((s, w) => s + (Number(w.cod_value) || 0), 0);
  const freightTotal = wb.reduce((s, w) => s + (Number(w.freight) || 0), 0);
  const successRate = total ? Math.round((cnt.delivered / total) * 1000) / 10 : 0;
  const returnRate = total ? Math.round((cnt.returned / total) * 1000) / 10 : 0;

  const { data: sumRow } = await sb.from("jt_summary").select("updated_at").eq("id", 1).maybeSingle();
  const lastSync = sumRow?.updated_at ? new Date(sumRow.updated_at).toLocaleString("vi-VN") : "—";

  const { t } = getT();

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Đối soát J&T ↔ sổ đơn")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Trạng thái giao hàng + công nợ COD tháng")} {month}. {t("Đồng bộ:")} {lastSync}</p>
        </div>
        <form className="flex gap-2 items-center">
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <div className="text-sm font-semibold mb-3">{t("Đối chiếu số đơn")}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("Đơn sổ đơn")} value={mshopOrders.toLocaleString("vi")} color="#6366F1" />
          <Stat label={t("Vận đơn J&T")} value={total.toLocaleString("vi")} color="#0EA5E9" />
          <Stat label={t("Chênh lệch")} value={(mshopOrders - total).toLocaleString("vi")} color={mshopOrders - total === 0 ? "#10B981" : "#F59E0B"} hint={t("sổ đơn − J&T")} />
          <Stat label={t("Tỉ lệ giao thành công")} value={successRate + "%"} color="#10B981" />
        </div>
        {Math.abs(mshopOrders - total) > 0 && (
          <p className="text-xs text-amber-600 mt-2">{t("Lệch")} {Math.abs(mshopOrders - total)} {t("đơn — có thể do đơn trong sổ chưa đẩy sang J&T, đơn nhiều SP gộp 1 vận đơn, hoặc giao kênh khác.")}</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label={t("Đã giao")} value={cnt.delivered.toLocaleString("vi")} color="#10B981" />
        <Stat label={t("Hoàn hàng")} value={cnt.returned.toLocaleString("vi")} color="#EF4444" hint={returnRate + t("% tỉ lệ hoàn")} />
        <Stat label={t("Đã hủy")} value={cnt.cancelled.toLocaleString("vi")} color="#6B7280" />
        <Stat label={t("Đang vận chuyển")} value={cnt.transit.toLocaleString("vi")} color="#F59E0B" />
        <Stat label={t("Vấn đề")} value={cnt.other.toLocaleString("vi")} color="#A855F7" />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <div className="text-sm font-semibold mb-3">{t("Công nợ COD (tiền thu hộ)")}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("COD đã thu (giao TC)")} value={fmtVND(codCollected)} color="#10B981" />
          <Stat label={t("COD đang treo (đang VC)")} value={fmtVND(codPending)} color="#F59E0B" hint={t("chờ giao + đối soát")} />
          <Stat label={t("COD đơn hoàn (mất thu)")} value={fmtVND(codReturned)} color="#EF4444" />
          <Stat label={t("Tổng cước phí J&T")} value={fmtVND(freightTotal)} color="#6B7280" />
        </div>
        <p className="text-xs text-gray-400 mt-2">{t("COD đã thu = tiền J&T phải chuyển trả về cho ACME từ các đơn giao thành công. Đối chiếu với sao kê J&T gửi.")}</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-semibold">{t("Nghi vấn thất thoát — hàng đã giao nhưng không tìm thấy đơn trong sổ đơn")}</div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${orphans.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {orphans.length} {t("đơn cần kiểm")}
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {t("Dò bằng SĐT người nhận (đối chiếu rộng 3 tháng). Nếu sale ghi đơn bằng SĐT khác SĐT nhận hàng thì vẫn hiện ở đây mà KHÔNG phải mất hàng — cần kiểm tay từng đơn.")}
        </p>
        {orphans.length === 0 ? (
          <p className="text-sm text-emerald-600">{t("Mọi đơn đã giao đều dò ra đơn bán tương ứng. Sạch.")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <Stat label={t("COD đã thu nhưng chưa thấy đơn")} value={fmtVND(orphanCod)} color="#EF4444" hint={t("tiền có thể chưa vào sổ")} />
              <Stat label={t("Giao rồi, COD = 0, không có đơn")} value={String(orphanFree)} color="#F59E0B" hint={t("hàng ra kho không thu tiền")} />
              <Stat label={t("Tổng đơn cần kiểm")} value={String(orphans.length)} color="#A855F7" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-3 font-medium">{t("Ngày")}</th>
                    <th className="py-2 pr-3 font-medium">{t("Vận đơn")}</th>
                    <th className="py-2 pr-3 font-medium">{t("Người nhận")}</th>
                    <th className="py-2 pr-3 font-medium">{t("Hàng")}</th>
                    <th className="py-2 pr-3 font-medium text-right">{t("COD")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orphans.slice(0, 40).map((w) => (
                    <tr key={w.waybill_no} className="border-b border-gray-50">
                      <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{String(w.order_create_time || "").slice(0, 10)}</td>
                      <td className="py-2 pr-3 tabular-nums text-gray-600">{w.waybill_no}</td>
                      <td className="py-2 pr-3">{w.receiver_name} <span className="text-gray-400">{w.receiver_phone}</span></td>
                      <td className="py-2 pr-3 text-gray-500 max-w-[240px] truncate">{w.goods_name || "—"}</td>
                      <td className={`py-2 pr-3 text-right sensitive ${Number(w.cod_value) > 0 ? "text-red-600 font-medium" : "text-amber-600"}`}>
                        {Number(w.cod_value) > 0 ? fmtVND(Number(w.cod_value)) : t("0đ — không thu")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {orphans.length > 40 && <p className="text-xs text-gray-400 mt-2">{t("…và")} {orphans.length - 40} {t("đơn nữa.")}</p>}
          </>
        )}
      </div>

      <JtClient rows={wb} />
    </div>
  );
}

