import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { getConfigValue } from "@/lib/app-config";
import CampaignClient from "./CampaignClient";
import { getT } from "@/lib/i18n-server";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Phễu & Chiến dịch | ACME Ops Hub") };
}

export default async function PheuPage({ searchParams }: { searchParams: { m?: string } }) {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(isManagerOrAbove(user.role) || isMktPosition((user as any).position))) redirect("/?denied=pheu");

  const sb = getServiceClient();
  const month = searchParams.m || vnDateStr().slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const from = `${month}-01`, to = `${month}-${String(dim).padStart(2, "0")}`;

  const li = (await layDoanhThuNhieuThang(sb, "2026-03-01", vnDateStr())).rows;
  const ord: Record<string, any> = {};
  for (const r of li) { const o = (ord[r.order_code] ??= { date: r.order_date, rev: 0, phone: r.customer_phone, channel: r.sale_channel || "Chưa rõ" }); o.rev += r.net_amount || 0; if (r.sale_channel && o.channel === "Chưa rõ") o.channel = r.sale_channel; }
  const orders = Object.values(ord);
  const mOrders = orders.filter((o: any) => (o.date || "") >= from && (o.date || "") <= to);

  const { data: chats } = await sb.from("salework_chat_analysis").select("phone, analyzed_at").gte("analyzed_at", from).lte("analyzed_at", to + "T23:59:59");
  const tuVan = new Set((chats ?? []).map(c => c.phone).filter(Boolean)).size;
  const chotKhach = new Set(mOrders.map((o: any) => o.phone).filter(Boolean)).size;
  const soDon = mOrders.length;
  const doanhThu = mOrders.reduce((s: number, o: any) => s + o.rev, 0);
  const tiLeChot = tuVan ? Math.round(chotKhach / tuVan * 1000) / 10 : 0;
  let repeatRate = 0; try { repeatRate = JSON.parse((await getConfigValue("sum_retention")) || "{}").repeatRate || 0; } catch { }

  const byCh: Record<string, { orders: number; rev: number; custs: Set<string> }> = {};
  for (const o of mOrders) { const c = (byCh[o.channel] ??= { orders: 0, rev: 0, custs: new Set() }); c.orders++; c.rev += o.rev; if (o.phone) c.custs.add(o.phone); }
  const channels = Object.entries(byCh).map(([k, v]) => ({ channel: k, orders: v.orders, rev: v.rev, custs: v.custs.size })).sort((a, b) => b.rev - a.rev);

  let campaigns: any[] = [];
  try { campaigns = JSON.parse((await getConfigValue("mkt_campaigns")) || "[]"); } catch { }
  const enriched = campaigns.map(c => {
    const inRange = orders.filter((o: any) => (o.date || "") >= c.start && (o.date || "") <= c.end && (c.channel === "Tất cả" || o.channel === c.channel));
    const actualRev = inRange.reduce((s: number, o: any) => s + o.rev, 0);
    const actualOrders = inRange.length;
    const budget = Number(c.budget) || 0;
    const roas = budget ? Math.round(actualRev / budget * 10) / 10 : null;
    const goalRev = Number(c.goalRevenue) || 0;
    return { ...c, actualRev, actualOrders, roas, goalPct: goalRev ? Math.round(actualRev / goalRev * 100) : null };
  }).sort((a, b) => (b.start < a.start ? -1 : 1));

  const funnel = [
    { label: t("Khách tư vấn (chat)"), value: tuVan, sub: t("khách được tư vấn Zalo") },
    { label: t("Khách chốt đơn"), value: chotKhach, sub: `${t("tỉ lệ chốt")} ${tiLeChot}%`, conv: tiLeChot },
    { label: t("Số đơn"), value: soDon, sub: "" },
    { label: t("Doanh thu"), value: doanhThu, money: true, sub: "" },
    { label: t("Tỉ lệ mua lại"), value: repeatRate, pct: true, sub: t("toàn thời gian") },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Phễu & Chiến dịch —")} {month}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Lead → tư vấn → chốt → tiền → mua lại. Đo chiến dịch MKT: chi vs đơn vs ROAS.")}</p>
        </div>
        <form className="flex gap-2 items-center">
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <div className="font-bold mb-3">{t("Phễu chuyển đổi tháng")} {month}</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {funnel.map((f, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-[11px] text-gray-500">{t(f.label)}</div>
              <div className="text-lg font-bold text-gray-900">{f.money ? fmtVND(f.value) : f.pct ? f.value + "%" : f.value.toLocaleString("vi")}</div>
              <div className="text-[11px] text-gray-400">{t(f.sub)}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">{t("Tư vấn từ Salework · chốt/đơn/DT từ sổ đơn Telegram (nối qua SĐT) · mua lại từ tổng hợp. Tỉ lệ chốt thấp = sale tư vấn nhiều mà ít ra đơn.")}</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <div className="font-bold mb-3">{t("Theo kênh")} ({month})</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-2">{t("Kênh")}</th><th className="text-right p-2">{t("Khách")}</th><th className="text-right p-2">{t("Đơn")}</th><th className="text-right p-2">{t("Doanh thu")}</th><th className="text-right p-2">% DT</th></tr></thead>
          <tbody>
            {channels.map((c, i) => (
              <tr key={i} className="border-t border-gray-100"><td className="p-2 font-medium">{c.channel}</td><td className="p-2 text-right">{c.custs}</td><td className="p-2 text-right">{c.orders}</td><td className="p-2 text-right font-semibold">{fmtVND(c.rev)}</td><td className="p-2 text-right text-gray-500">{doanhThu ? Math.round(c.rev / doanhThu * 100) : 0}%</td></tr>
            ))}
            {!channels.length && <tr><td colSpan={5} className="p-6 text-center text-gray-400">{t("Chưa có đơn tháng này")}</td></tr>}
          </tbody>
        </table>
      </div>

      <CampaignClient campaigns={enriched} />
    </div>
  );
}
