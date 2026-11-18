import { getServiceClient } from "@/lib/supabase-server";
import { layDoanhThu } from "@/lib/doanh-thu";
import { fmtVND } from "@/lib/payroll";
import { requireManager } from "@/lib/auth-server";
import { monthRange } from "@/lib/date-range";
import { ShoppingCart, TrendingUp, Users, Package, Percent, Truck, Boxes, Receipt } from "lucide-react";
import { getT } from "@/lib/i18n-server";
import { Stat } from "@/components/stat";

export const dynamic = "force-dynamic";

export default async function SalesPage({ searchParams }: { searchParams: { m?: string } }) {
  const { t } = getT();
  const user = await requireManager();

  const month = searchParams.m ?? new Date().toISOString().slice(0, 7);
  const { start, nextStart } = monthRange(month);
  const sb = getServiceClient();

  const [{ data: products }, { data: customers }] = await Promise.all([
    sb.from("products").select("*").eq("active", true),
    sb.from("customers").select("*", { count: "exact" })
  ]);

  const denCuoi = new Date(new Date(nextStart + "T00:00:00Z").getTime() - 864e5).toISOString().slice(0, 10);
  const liRows: any[] = (await layDoanhThu(sb, start, denCuoi)).rows;
  let orders: any[];
  if (liRows.length) {
    const agg: Record<string, any> = {};
    for (const r of liRows) {
      const o = (agg[r.order_code] ??= { id: r.order_code, order_code: r.order_code, order_date: r.order_date, channel: r.sale_channel || t("Chưa phân loại"), status: "delivered", customers: { full_name: r.customer_name, phone: r.customer_phone }, users: { full_name: r.sale_name }, gross_revenue: 0, net_revenue: 0, final_revenue: 0, discount_value: 0, shipping_cost: 0, quantity: 0, items: [] });
      if (r.sale_channel && o.channel === t("Chưa phân loại")) o.channel = r.sale_channel;
      o.gross_revenue += r.gross_amount || 0; o.net_revenue += r.net_amount || 0; o.final_revenue += r.net_amount || 0; o.discount_value += r.discount || 0; o.quantity += r.quantity || 0;
      if (r.product_name) o.items.push(r.product_name);
      if ((r.order_date || "") > o.order_date) o.order_date = r.order_date;
    }
    orders = Object.values(agg).sort((a, b) => (a.order_date < b.order_date ? 1 : -1));
  } else {
    const { data } = await sb.from("orders").select("*, customers(full_name, phone), users!orders_salesperson_id_fkey(full_name)").gte("order_date", start).lt("order_date", nextStart).order("order_date", { ascending: false });
    orders = data ?? [];
  }

  const monthCustomers = new Set((orders ?? []).map((o: any) => o.customers?.phone || o.customer_id).filter(Boolean)).size;

  const totalGross = (orders ?? []).reduce((s: number, o: any) => s + (o.gross_revenue || 0), 0);
  const totalNet = (orders ?? []).reduce((s: number, o: any) => s + (o.net_revenue || 0), 0);
  const totalFinal = (orders ?? []).reduce((s: number, o: any) => s + (o.final_revenue || 0), 0);
  const totalDiscount = (orders ?? []).reduce((s: number, o: any) => s + (o.discount_value || 0), 0);
  const totalShipping = (orders ?? []).reduce((s: number, o: any) => s + (o.shipping_cost || 0), 0);
  const totalQty = (orders ?? []).reduce((s: number, o: any) => s + (o.quantity || 0), 0);

  const nowISO = new Date().toISOString().slice(0, 7);
  const selDays = month === nowISO
    ? new Date().getUTCDate()
    : new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const py = +month.slice(0, 4), pm = +month.slice(5, 7);
  const prevY = pm === 1 ? py - 1 : py, prevM = pm === 1 ? 12 : pm - 1;
  const pMon = `${prevY}-${String(prevM).padStart(2, "0")}`;
  const prevDays = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  const prevStart = `${pMon}-01`;
  const prevEnd = `${pMon}-${String(Math.min(selDays, prevDays)).padStart(2, "0")}`;
  const prevRows: any[] = (await layDoanhThu(sb, prevStart, prevEnd)).rows;
  const prevFinal = prevRows.reduce((s, r: any) => s + (r.net_amount || 0), 0);
  const prevOrders = new Set(prevRows.map((r: any) => r.order_code)).size;
  const prevQty = prevRows.reduce((s, r: any) => s + (r.quantity || 0), 0);
  const prevCustomers = new Set(prevRows.map((r: any) => r.customer_phone || r.customer_name).filter(Boolean)).size;
  const dlt = (cur: number, prev: number) => prev > 0 ? Math.round((cur - prev) / prev * 1000) / 10 : undefined;
  const cmp = `so ${pMon} (tới ${Math.min(selDays, prevDays)}/${prevM})`;

  const byChannel: Record<string, { count: number; revenue: number }> = {};
  (orders ?? []).forEach((o: any) => {
    const ch = o.channel || t("Khác");
    if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0 };
    byChannel[ch].count++;
    byChannel[ch].revenue += o.final_revenue || 0;
  });

  const byStatus: Record<string, number> = {};
  (orders ?? []).forEach((o: any) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart className="w-6 h-6 text-brand-600" /> {t("Bán hàng")} — {month}</h1>
        <form className="flex gap-2 items-center">
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label={t("DOANH THU CUỐI")} value={fmtVND(totalFinal)} color="#10B981" icon={TrendingUp} delta={dlt(totalFinal, prevFinal)} hint={cmp} sensitive />
        <Stat label={t("DT THÔ")} value={fmtVND(totalGross)} color="#1a73e8" icon={ShoppingCart} sensitive />
        <Stat label={t("ĐƠN")} value={String(orders?.length ?? 0)} color="#8B5CF6" icon={Receipt} delta={dlt(orders?.length ?? 0, prevOrders)} hint={cmp} />
        <Stat label={t("KHÁCH")} value={String(monthCustomers)} color="#EC4899" icon={Users} delta={dlt(monthCustomers, prevCustomers)} hint={cmp} />
        <Stat label={t("SỐ LƯỢNG")} value={String(totalQty)} color="#06B6D4" icon={Boxes} delta={dlt(totalQty, prevQty)} hint={cmp} />
        <Stat label={t("GIẢM GIÁ")} value={fmtVND(totalDiscount)} color="#F59E0B" icon={Percent} sensitive />
        <Stat label={t("SHIP")} value={fmtVND(totalShipping)} color="#EF4444" icon={Truck} sensitive />
        <Stat label={t("SẢN PHẨM")} value={String(products?.length ?? 0)} color="#84CC16" icon={Package} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <h3 className="font-semibold mb-3">{t("Doanh thu theo kênh")}</h3>
          <div className="space-y-2">
            {Object.entries(byChannel).sort((a, b) => b[1].revenue - a[1].revenue).map(([ch, data]) => {
              const pct = totalFinal > 0 ? (data.revenue / totalFinal) * 100 : 0;
              return (
                <div key={ch}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{ch}</span>
                    <span>{fmtVND(data.revenue)} <span className="text-gray-400">({data.count} {t("đơn")})</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-brand-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(byChannel).length === 0 && <div className="text-center py-8 text-gray-400 text-sm">{t("Chưa có đơn hàng tháng này")}</div>}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <h3 className="font-semibold mb-3">{t("Trạng thái đơn")}</h3>
          <div className="space-y-2">
            {Object.entries(byStatus).map(([s, count]) => {
              const colors: any = {
                pending: "bg-yellow-100 text-yellow-700",
                confirmed: "bg-blue-100 text-blue-700",
                shipping: "bg-purple-100 text-purple-700",
                delivered: "bg-green-100 text-green-700",
                cancelled: "bg-gray-100 text-gray-600",
                refunded: "bg-red-100 text-red-700"
              };
              const labels: any = { pending: t("Chờ xử lý"), confirmed: t("Đã xác nhận"), shipping: t("Đang giao"), delivered: t("Đã giao"), cancelled: t("Huỷ"), refunded: t("Hoàn tiền") };
              return (
                <div key={s} className={`flex justify-between items-center px-3 py-2 rounded ${colors[s] || "bg-gray-100"}`}>
                  <span className="text-sm font-medium">{labels[s] || s}</span>
                  <span className="font-bold">{count}</span>
                </div>
              );
            })}
            {Object.keys(byStatus).length === 0 && <div className="text-center py-8 text-gray-400 text-sm">—</div>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold">{t("Đơn hàng tháng này")} ({orders?.length ?? 0})</h3>
          <button className="px-3 py-1.5 bg-brand-600 text-white rounded text-sm">{t("+ Thêm đơn")}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-3">{t("Ngày")}</th>
                <th className="text-left p-3">{t("Mã đơn")}</th>
                <th className="text-left p-3">{t("Khách")}</th>
                <th className="text-left p-3">{t("Mua gì")}</th>
                <th className="text-left p-3">{t("Sale")}</th>
                <th className="text-right p-3">{t("SL")}</th>
                <th className="text-right p-3">{t("DT cuối")}</th>
                <th className="text-left p-3">{t("Trạng thái")}</th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o: any) => (
                <tr key={o.id} className="border-t border-gray-100">
                  <td className="p-3">{o.order_date}</td>
                  <td className="p-3 tabular-nums text-xs">{o.order_code || o.id.slice(0, 8)}</td>
                  <td className="p-3">{o.customers?.full_name || "—"}<div className="text-[11px] text-gray-400">{o.customers?.phone || ""}</div></td>
                  <td className="p-3 text-xs text-gray-600 max-w-[260px]">{o.items?.length ? (o.items.length <= 2 ? o.items.join(", ") : `${o.items.slice(0, 2).join(", ")} +${o.items.length - 2}`) : (o.channel || "—")}</td>
                  <td className="p-3 text-xs">{o.users?.full_name || "—"}</td>
                  <td className="p-3 text-right">{o.quantity}</td>
                  <td className="p-3 text-right tabular-nums font-semibold">{fmtVND(o.final_revenue)}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-xs bg-gray-100">{o.status}</span></td>
                </tr>
              ))}
              {(!orders || orders.length === 0) && (
                <tr><td colSpan={8} className="p-12 text-center text-gray-400">{t('Chưa có đơn hàng — bấm "+ Thêm đơn" hoặc sync từ Pancake')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-500 italic">
        {t("Sắp tới: Sync tự động từ Pancake / Shopee / TikTok Shop API")}
      </div>
    </div>
  );
}

