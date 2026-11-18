import { getT } from "@/lib/i18n-server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { canProcessOnlineOrders } from "./access";
import { StatusControl } from "./status-control";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ thanh toán", confirmed: "Đã thanh toán", shipping: "Đang giao",
  delivered: "Đã giao", cancelled: "Huỷ", refunded: "Hoàn tiền",
};
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", confirmed: "bg-green-100 text-green-700",
  shipping: "bg-blue-100 text-blue-700", delivered: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700", refunded: "bg-purple-100 text-purple-700",
};

function fmtVND(n: number | null) { return (n || 0).toLocaleString("vi-VN"); }
function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch { return iso; }
}
function addrFrom(o: any) {

  const m = (o.notes || "").match(/ĐC:\s*([^|]+)/);
  return m ? m[1].trim() : "";
}

export default async function DonOnlinePage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canProcessOnlineOrders(user)) redirect("/");

  const sb = getServiceClient();
  const { data: orders } = await sb
    .from("orders")
    .select("id, order_code, channel, sub_channel, gross_revenue, quantity, status, order_date, created_at, notes, customers(full_name, phone, email), salesperson:users!salesperson_id(full_name)")
    .eq("source_platform", "salepage")
    .order("created_at", { ascending: false })
    .limit(300);

  const list = orders || [];
  const counts = {
    pending: list.filter((o: any) => o.status === "pending").length,
    confirmed: list.filter((o: any) => o.status === "confirmed").length,
    shipping: list.filter((o: any) => o.status === "shipping").length,
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">{t("Đơn online (Sale Page)")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Đơn từ trang bán hàng đẩy về tự động. Sale chốt/CSKH, kho xử lý giao hàng.")}</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="text-2xl font-bold text-amber-800">{counts.pending}</div>
          <div className="text-xs text-amber-700">{t("Chờ thanh toán")}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <div className="text-2xl font-bold text-green-700">{counts.confirmed}</div>
          <div className="text-xs text-green-700">{t("Đã TT — chờ kho xử lý")}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="text-2xl font-bold text-blue-700">{counts.shipping}</div>
          <div className="text-xs text-blue-700">{t("Đang giao")}</div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-3 py-2.5">{t("Thời gian")}</th>
              <th className="px-3 py-2.5">{t("Khách hàng")}</th>
              <th className="px-3 py-2.5">{t("SĐT")}</th>
              <th className="px-3 py-2.5">{t("Địa chỉ")}</th>
              <th className="px-3 py-2.5">Combo</th>
              <th className="px-3 py-2.5">{t("Sale phụ trách")}</th>
              <th className="px-3 py-2.5 text-right">{t("Số tiền")}</th>
              <th className="px-3 py-2.5">{t("Trạng thái")}</th>
              <th className="px-3 py-2.5">{t("Xử lý")}</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">{t("Chưa có đơn online nào.")}</td></tr>
            )}
            {list.map((o: any) => (
              <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 text-xs">{fmtDateTime(o.created_at)}</td>
                <td className="px-3 py-2.5 font-medium text-gray-900">{o.customers?.full_name || "—"}</td>
                <td className="px-3 py-2.5 text-gray-700">{o.customers?.phone || "—"}{o.customers?.email ? <div className="text-[11px] text-gray-400">{o.customers.email}</div> : null}</td>
                <td className="px-3 py-2.5 text-gray-600 max-w-[220px]">{addrFrom(o)}</td>
                <td className="px-3 py-2.5 text-gray-700">{o.sub_channel || `${o.quantity || ""} hộp`}</td>
                <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{o.salesperson?.full_name || "—"}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-rose-600 whitespace-nowrap">{fmtVND(o.gross_revenue)}đ</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_CLASS[o.status] || "bg-gray-100 text-gray-600"}`}>
                    {t(STATUS_LABEL[o.status]) || o.status}
                  </span>
                </td>
                <td className="px-3 py-2.5"><StatusControl orderId={o.id} value={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
