import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { isManagerOrAbove } from "@/lib/auth";
import { getConfigNumber } from "@/lib/app-config";
import { CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026, buildMonthlyTargets2026 } from "@/lib/bi-targets";
import { getLoopAssumptions } from "@/lib/revenue-loop";
import { decomposeTarget } from "@/lib/kpi-planner";
import { getT } from "@/lib/i18n-server";
import { layDoanhThu, tuoiNguonDon, gopTenSale } from "@/lib/doanh-thu";
import { Stat as BaseStat } from "@/components/stat";
import { Target, CheckCircle2, Activity, Package, Users, BarChart3, CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

const norm = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");
const weightFor = (pos?: string | null) => {
  const p = (pos || "").toLowerCase();
  if (/trực page|truc page/.test(p)) return 0;
  if (/leader/.test(p)) return 1.5;
  if (/thử việc|thu viec/.test(p)) return 0.7;
  return 1.0;
};

export default async function BaoCaoSalePage({ searchParams }: { searchParams: { m?: string } }) {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role))) redirect("/");

  const sb = getServiceClient();
  const month = searchParams.m || vnDateStr().slice(0, 7);
  const [y, mo] = month.split("-").map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const todayStr = vnDateStr();
  const isCurMonth = todayStr.slice(0, 7) === month;
  const daysElapsed = isCurMonth ? Number(todayStr.slice(8, 10)) : daysInMonth;

  const denNgay = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const [dt, tuoi] = await Promise.all([
    layDoanhThu(sb, `${month}-01`, denNgay),
    tuoiNguonDon(sb),
  ]);
  const rows: any[] = dt.rows;
  const nguonChinh = dt.ngayTele.length >= dt.ngayMisa.length ? "Sổ đơn Telegram" : "MISA (đỡ ngày sổ chưa phủ)";

  const hasData = rows.length > 0;

  const { data: users } = await sb.from("users").select("full_name,position,active");
  const userByName = new Map((users ?? []).map((u: any) => [norm(u.full_name), u]));

  const gopTen = gopTenSale((users ?? []).map((u: any) => ({ ten: u.full_name })));

  type S = { name: string; revenue: number; orders: Set<string>; custs: Set<string>; days: Record<string, number>; prods: Record<string, { qty: number; rev: number }>; weight: number; matched: boolean };
  const sales: Record<string, S> = {};
  const dayTotal: Record<string, number> = {};
  let teamRevenue = 0;
  for (const r of rows) {
    const name = (gopTen(r.sale_name) || r.sale_name || "—").trim() || "—";
    const u = userByName.get(norm(name));
    const s = (sales[name] ??= { name, revenue: 0, orders: new Set(), custs: new Set(), days: {}, prods: {}, weight: u ? weightFor(u.position) : 0, matched: !!u });
    s.revenue += r.net_amount || 0;
    if (r.order_code) s.orders.add(r.order_code);
    if (r.customer_phone) s.custs.add(r.customer_phone);
    const d = (r.order_date || "").slice(0, 10);
    if (d) { s.days[d] = (s.days[d] || 0) + (r.net_amount || 0); dayTotal[d] = (dayTotal[d] || 0) + (r.net_amount || 0); }
    const pn = r.product_name || r.sku || "?";
    const p = (s.prods[pn] ??= { qty: 0, rev: 0 }); p.qty += r.quantity || 0; p.rev += r.net_amount || 0;
    teamRevenue += r.net_amount || 0;
  }

  const annualTarget = await getConfigNumber(CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026);
  const monthActual: Record<string, number> = { [month]: teamRevenue };
  const { rows: tRows } = buildMonthlyTargets2026(annualTarget, monthActual, month);
  const teamTarget = tRows.find(r => r.month === month)?.target || 0;
  const sumWeight = Object.values(sales).reduce((s, x) => s + x.weight, 0) || 1;

  const expectedPct = Math.round(daysElapsed / daysInMonth * 100);
  const daysLeft = Math.max(0, daysInMonth - daysElapsed);

  const A = await getLoopAssumptions();
  const teamOrders0 = Object.values(sales).reduce((a, s) => a + s.orders.size, 0);
  const teamAov = teamOrders0 > 0 ? teamRevenue / teamOrders0 : 1_000_000;
  const saleList = Object.values(sales).map(s => {
    const target = s.weight > 0 ? teamTarget * s.weight / sumWeight : 0;
    const topProds = Object.entries(s.prods).sort((a, b) => b[1].rev - a[1].rev).slice(0, 3);
    const pct = target > 0 ? Math.round(s.revenue / target * 100) : null;

    const gap = Math.max(0, target - s.revenue);
    const aov = s.orders.size > 0 ? s.revenue / s.orders.size : teamAov;
    const casc = decomposeTarget({ monthTarget: gap, aov: aov || teamAov || 1, ordersPerCustomer: A.ordersPerCustomer, closeRate: A.closeRate, workDaysPerMonth: A.workDaysPerMonth, weeksPerMonth: A.weeksPerMonth });
    const needOrders = Math.ceil(casc.ordersMonth || 0);
    const needCusts = Math.ceil(casc.customersMonth || 0);
    const needLeads = Math.ceil(casc.leadsMonth || 0);
    const perDayOrders = daysLeft > 0 ? Math.ceil(needOrders / daysLeft) : needOrders;
    const onTrack = pct != null && pct >= expectedPct;
    return { ...s, target, topProds, pct, gap, needOrders, needCusts, needLeads, perDayOrders, onTrack };
  }).sort((a, b) => b.revenue - a.revenue);

  const teamPct = teamTarget > 0 ? Math.round(teamRevenue / teamTarget * 100) : 0;
  const totalOrders = Object.values(sales).reduce((a, s) => a + s.orders.size, 0);
  const totalCusts = new Set(rows.map(r => r.customer_phone).filter(Boolean)).size;
  const dayKeys = Object.keys(dayTotal).sort().reverse();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-brand-600" /> {t("Báo cáo Sale theo ngày")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Mỗi sale bán bao nhiêu, mặt hàng nào · KPI áp vào vs thực tế. Nguồn: sổ đơn nhóm Telegram (cửa lib/doanh-thu), doanh thu NET đã trừ VAT.")}</p>
        </div>
        <form className="flex gap-2 items-center">
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className={`rounded-lg px-3 py-2 text-xs border ${(tuoi.teleTre ?? 99) <= 2 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
        <span className={`inline-block w-2 h-2 rounded-full align-middle mr-1.5 ${(tuoi.teleTre ?? 99) <= 2 ? "bg-emerald-500" : "bg-amber-500"}`} />
        {t("Nguồn")}: <b>{nguonChinh}</b> · {t("sổ đơn bóc tới")} <b>{tuoi.teleToi || "—"}</b>
        {tuoi.teleTre != null && tuoi.teleTre > 2 && <> ({tuoi.teleTre} {t("ngày trước — kiểm cron tg-boc-don")})</>}
        {dt.ngayNgo.length > 0 && <> · {dt.ngayNgo.length} {t("ngày sổ bóc mỏng hơn MISA, số ngày đó đáng ngờ")}</>}
      </div>
      {!hasData ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
          {t("Chưa có đơn nào trong sổ cho tháng")} {month}. {t("Sổ đơn bóc từ nhóm Telegram bằng cron tg-boc-don (2 lần/giờ); tháng cũ trước 07/2026 chỉ có ở MISA và cửa doanh thu tự lùi về đó.")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={t("KPI tháng (team)")} value={fmtVND(teamTarget)} tone="slate" icon={Target} />
            <Stat label={t("Thực tế")} value={fmtVND(teamRevenue)} sub={`${teamPct}% KPI`} tone={teamPct >= 100 ? "emerald" : teamPct >= expectedPct ? "blue" : "red"} icon={CheckCircle2} />
            <Stat label={`${t("Nhịp")} (${daysElapsed}/${daysInMonth} ${t("ngày")})`} value={`${expectedPct}%`} sub={teamPct >= expectedPct ? t("đang bám kịp") : t("đang chậm")} tone={teamPct >= expectedPct ? "emerald" : "red"} icon={Activity} />
            <Stat label={t("Đơn / Khách")} value={`${totalOrders}`} sub={`${totalCusts} ${t("khách")}`} tone="slate" icon={Package} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <div className="p-4 border-b border-gray-100 font-semibold text-sm flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-500" /> {t("Theo từng sale — KPI vs thực tế + CÒN CẦN để đạt (tháng")} {month})</span>
              <span className="text-xs font-normal flex gap-3">
                <a href="/vong-lap-doanh-thu" className="text-blue-600 hover:underline">{t("Phễu (lead · ads) →")}</a>
                <a href="/chat-quality" className="text-blue-600 hover:underline">{t("Chất lượng tư vấn →")}</a>
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left p-3">{t("Sale")}</th>
                  <th className="text-right p-3">{t("KPI tháng")}</th>
                  <th className="text-right p-3">{t("Thực tế")}</th>
                  <th className="text-right p-3">% KPI</th>
                  <th className="text-right p-3">{t("Còn cần (đạt KPI)")}</th>
                  <th className="text-right p-3">{t("Mỗi ngày cần")}</th>
                  <th className="text-right p-3">{t("Đơn")}</th>
                  <th className="text-right p-3">{t("Khách")}</th>
                  <th className="text-left p-3">{t("Top mặt hàng")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {saleList.map(s => (
                  <tr key={s.name} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-3 font-medium">{s.name}{!s.matched && <span className="ml-1 text-[10px] text-gray-400">{t("(ngoài DS)")}</span>}</td>
                    <td className="p-3 text-right text-gray-500">{s.target > 0 ? fmtVND(s.target) : "—"}</td>
                    <td className="p-3 text-right font-semibold text-emerald-700">{fmtVND(s.revenue)}</td>
                    <td className="p-3 text-right">{s.pct == null ? "—" : <span className={s.pct >= 100 ? "text-emerald-700 font-bold" : s.pct >= expectedPct ? "text-blue-600" : "text-red-600"}>{s.pct}%</span>}</td>
                    <td className="p-3 text-right text-xs whitespace-nowrap">{s.gap > 0 ? <span className="text-gray-700"><b>{s.needOrders}</b> {t("đơn")} · {s.needCusts} {t("khách")}</span> : <span className="text-emerald-600 font-semibold">✓ {t("đạt")}</span>}</td>
                    <td className="p-3 text-right text-xs whitespace-nowrap">{s.gap > 0 && daysLeft > 0 ? <span className={s.onTrack ? "text-gray-500" : "text-red-600 font-semibold"}>{s.perDayOrders} {t("đơn/ngày")}</span> : "—"}</td>
                    <td className="p-3 text-right">{s.orders.size}</td>
                    <td className="p-3 text-right">{s.custs.size}</td>
                    <td className="p-3 text-xs text-gray-600">{s.topProds.map(([n, v]) => `${n.slice(0, 24)} (${v.qty})`).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <div className="p-4 border-b border-gray-100 font-semibold text-sm flex items-center gap-2"><CalendarDays className="w-4 h-4 text-gray-500" /> {t("Doanh thu theo ngày")}</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr><th className="text-left p-3">{t("Ngày")}</th><th className="text-right p-3">{t("Doanh thu")}</th><th className="text-left p-3">{t("Sale bán trong ngày")}</th></tr>
              </thead>
              <tbody className="tabular-nums">
                {dayKeys.map(d => {
                  const perSale = saleList.map(s => ({ name: s.name, v: s.days[d] || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
                  return (
                    <tr key={d} className={`border-t border-gray-100 ${d === todayStr ? "bg-amber-50" : ""}`}>
                      <td className="p-3 font-medium">{d.slice(8)}/{d.slice(5, 7)}{d === todayStr && <span className="ml-1 text-[10px] text-amber-700">{t("hôm nay")}</span>}</td>
                      <td className="p-3 text-right font-semibold">{fmtVND(dayTotal[d])}</td>
                      <td className="p-3 text-xs text-gray-600">{perSale.map(x => `${x.name.split(" ").slice(-1)[0]}: ${fmtVND(x.v)}`).join(" · ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">{t("KPI/sale = mục tiêu tháng team chia theo trọng số vai trò (Leader 1.5 · NV 1.0 · Thử việc 0.7 · Trực page 0). Doanh thu = NET đã trừ VAT 8% từ số khách trả trong sổ đơn (khớp P&L). Lãi gộp và quà tặng theo giá vốn không còn ở trang này — hai số đó vẫn kẹt nguồn MISA (mục 12.0b sổ tay).")}</p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: string; icon?: any }) {
  const c: Record<string, string> = { slate: "#334155", emerald: "#10B981", blue: "#1a73e8", red: "#EF4444" };
  return <BaseStat label={label} value={value} hint={sub} color={c[tone] || "#334155"} icon={icon} sensitive />;
}
