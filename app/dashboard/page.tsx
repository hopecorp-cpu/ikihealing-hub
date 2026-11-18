import { getServiceClient } from "@/lib/supabase-server";
import { layDoanhThu } from "@/lib/doanh-thu";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { requireBaoCaoChung } from "@/lib/auth-server";
import { ACME_TARGETS, calcPace, classifyProductLine, PRODUCT_LINE_INFO, fmtCompact, DEFAULT_ANNUAL_TARGET_2026, CONFIG_KEY_ANNUAL_TARGET, buildMonthlyTargets2026 } from "@/lib/bi-targets";
import { getConfigNumber } from "@/lib/app-config";
import { isAdmin as roleIsAdmin, isBodRole } from "@/lib/auth";
import { DashboardTabs } from "./tabs";
import { FilterBar } from "./filter-bar";
import { YearlyTarget } from "./yearly-target";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

type Range = "today" | "7d" | "30d" | "mtd" | "qtd" | "ytd" | string;

function rangeToDates(r: Range): { from: string; to: string; prevFrom: string; prevTo: string; prevYearFrom: string; prevYearTo: string; label: string; totalDays: number; daysElapsed: number } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const sub = (n: number) => { const x = new Date(today); x.setDate(x.getDate() - n); return x; };

  let from: Date, to: Date, prevFrom: Date, prevTo: Date, prevYearFrom: Date, prevYearTo: Date, label: string;

  if (typeof r === "string" && r.startsWith("month:")) {
    const m = r.slice(6);
    const [y, mo] = m.split("-").map(Number);
    from = new Date(y, mo - 1, 1);
    to = new Date(y, mo, 0);
    prevFrom = new Date(y, mo - 2, 1);
    prevTo = new Date(y, mo - 1, 0);
    prevYearFrom = new Date(y - 1, mo - 1, 1);
    prevYearTo = new Date(y - 1, mo, 0);
    label = `Tháng ${mo}/${y}`;
    const totalDays = to.getDate();
    return {
      from: iso(from), to: iso(to),
      prevFrom: iso(prevFrom), prevTo: iso(prevTo),
      prevYearFrom: iso(prevYearFrom), prevYearTo: iso(prevYearTo),
      label, totalDays, daysElapsed: totalDays
    };
  }

  if (typeof r === "string" && r.startsWith("quarter:")) {
    const q = r.slice(8);
    const [yStr, qStr] = q.split("-Q");
    const y = parseInt(yStr), qNum = parseInt(qStr);
    from = new Date(y, (qNum - 1) * 3, 1);
    to = new Date(y, qNum * 3, 0);
    prevFrom = new Date(y, (qNum - 2) * 3, 1);
    prevTo = new Date(y, (qNum - 1) * 3, 0);
    prevYearFrom = new Date(y - 1, (qNum - 1) * 3, 1);
    prevYearTo = new Date(y - 1, qNum * 3, 0);
    label = `Q${qNum}/${y}`;
    const totalDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    return {
      from: iso(from), to: iso(to),
      prevFrom: iso(prevFrom), prevTo: iso(prevTo),
      prevYearFrom: iso(prevYearFrom), prevYearTo: iso(prevYearTo),
      label, totalDays, daysElapsed: totalDays
    };
  }

  switch (r) {
    case "today":
      from = to = today; prevFrom = prevTo = sub(1);
      prevYearFrom = prevYearTo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      label = "Hôm nay";
      break;
    case "7d":
      from = sub(6); to = today; prevFrom = sub(13); prevTo = sub(7);
      prevYearFrom = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() - 6);
      prevYearTo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      label = "7 ngày";
      break;
    case "30d":
      from = sub(29); to = today; prevFrom = sub(59); prevTo = sub(30);
      prevYearFrom = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() - 29);
      prevYearTo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      label = "30 ngày";
      break;
    case "qtd": {
      const q = Math.floor(today.getMonth() / 3);
      from = new Date(today.getFullYear(), q * 3, 1);
      to = today;
      prevFrom = new Date(today.getFullYear(), (q - 1) * 3, 1);
      prevTo = new Date(today.getFullYear(), q * 3, 0);
      prevYearFrom = new Date(today.getFullYear() - 1, q * 3, 1);
      prevYearTo = new Date(today.getFullYear() - 1, (q + 1) * 3, 0);
      label = "Quý này (QTD)";
      break;
    }
    case "ytd":
      from = new Date(today.getFullYear(), 0, 1); to = today;
      prevFrom = new Date(today.getFullYear() - 1, 0, 1);
      prevTo = new Date(today.getFullYear() - 1, 11, 31);
      prevYearFrom = prevFrom; prevYearTo = prevTo;
      label = "Năm nay (YTD)";
      break;
    case "mtd":
    default: {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = today;
      prevFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      prevTo = new Date(today.getFullYear(), today.getMonth(), 0);
      prevYearFrom = new Date(today.getFullYear() - 1, today.getMonth(), 1);
      prevYearTo = new Date(today.getFullYear() - 1, today.getMonth() + 1, 0);
      label = "Tháng này (MTD)";
    }
  }

  let totalDays: number, daysElapsed: number;
  if (r === "today") { totalDays = 1; daysElapsed = 1; }
  else if (r === "mtd") {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    totalDays = end; daysElapsed = today.getDate();
  } else if (r === "qtd") {
    totalDays = 90;
    daysElapsed = Math.floor((today.getTime() - from.getTime()) / 86400000) + 1;
  } else if (r === "ytd") {
    totalDays = 365;
    daysElapsed = Math.floor((today.getTime() - from.getTime()) / 86400000) + 1;
  } else {
    totalDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    daysElapsed = totalDays;
  }

  return {
    from: iso(from), to: iso(to),
    prevFrom: iso(prevFrom), prevTo: iso(prevTo),
    prevYearFrom: iso(prevYearFrom), prevYearTo: iso(prevYearTo),
    label, totalDays, daysElapsed
  };
}

export default async function DashboardPage({ searchParams }: { searchParams: { range?: Range; channel?: string; subch?: string; product?: string; customer?: string; sale?: string; tab?: string } }) {
  const dashUser = await requireBaoCaoChung();
  const cheBod = isBodRole(dashUser.role);
  const canEditTarget = roleIsAdmin(dashUser.role);
  const { t } = getT();

  const range = (searchParams.range as Range) || "mtd";
  const tab = cheBod && searchParams.tab === "customers" ? "executive" : (searchParams.tab || "executive");
  const channelFilter = searchParams.channel || "";
  const subChannelFilter = searchParams.subch || "";
  const productFilter = searchParams.product || "";
  const customerFilter = cheBod ? "" : (searchParams.customer || "");
  const saleFilter = searchParams.sale || "";
  const { from, to, prevFrom, prevTo, prevYearFrom, prevYearTo, label, totalDays, daysElapsed } = rangeToDates(range);

  const sb = getServiceClient();

  const fetchLI = async (f: string, t: string) => {

    return (await layDoanhThu(sb, f, t)).rows as any[];
  };
  const aggregateLI = (rows: any[]) => {
    const m: Record<string, any> = {};
    for (const r of rows) {
      const o = (m[r.order_code] ??= { id: r.order_code, order_code: r.order_code, customer_id: r.customer_phone || null, salesperson_id: r.sale_name || null, channel: r.sale_channel || "Chưa phân loại", sub_channel: r.sale_channel || "MISA", gross_revenue: 0, discount_value: 0, shipping_cost: 0, net_revenue: 0, final_revenue: 0, quantity: 0, status: "delivered", order_date: r.order_date, customers: { full_name: r.customer_name }, users: { full_name: r.sale_name } });
      o.gross_revenue += r.gross_amount || 0; o.discount_value += r.discount || 0; o.net_revenue += r.net_amount || 0; o.final_revenue += r.net_amount || 0; o.quantity += r.quantity || 0;
      if ((r.order_date || "") > o.order_date) o.order_date = r.order_date;
    }
    return Object.values(m);
  };

  const [{ data: productsRaw }, { data: customers }, { data: salesUsers }, { data: students }, { data: payroll }] = await Promise.all([
    sb.from("products").select("id, name, sku, category, active"),
    cheBod ? Promise.resolve({ data: [] }) : sb.from("customers").select("id, full_name, created_at"),
    sb.from("users").select("id, full_name, position, departments!users_department_id_fkey(name, color)").eq("active", true),
    sb.from("students").select("paid_amount, course_id, enrolled_at").gte("enrolled_at", from).lte("enrolled_at", to),
    cheBod ? Promise.resolve({ data: [] }) : sb.from("payroll").select("net_salary, total_company_cost, bonus_amount").eq("month", from.slice(0, 7)),
  ]);

  const liCur = await fetchLI(from, to);
  let orders: any[], prevOrders: any[], prevYearOrders: any[], orderItems: any[];
  let products = productsRaw ?? [];
  const MISA_START = "2026-03-01";
  const fetchPreMisa = async (f: string, t: string) => {
    if (f >= MISA_START) return [];
    const cap = t < MISA_START ? t : "2026-02-28";
    const { data } = await sb.from("orders").select(`id, order_code, customer_id, salesperson_id, channel, sub_channel, gross_revenue, discount_value, shipping_cost, net_revenue, final_revenue, quantity, status, order_date, customers(full_name), users:salesperson_id(full_name)`)
      .gte("order_date", f).lte("order_date", cap).neq("status", "cancelled").neq("status", "refunded");
    return data ?? [];
  };
  if (liCur.length) {
    orders = aggregateLI(liCur).concat(await fetchPreMisa(from, to));
    prevOrders = aggregateLI(await fetchLI(prevFrom, prevTo)).concat(await fetchPreMisa(prevFrom, prevTo));
    prevYearOrders = aggregateLI(await fetchLI(prevYearFrom, prevYearTo)).concat(await fetchPreMisa(prevYearFrom, prevYearTo));
    orderItems = liCur.filter(r => r.sku).map(r => ({ product_id: r.sku, quantity: r.quantity, unit_price: r.net_amount, subtotal: r.net_amount, orders: { id: r.order_code } }));
    const liProds: Record<string, any> = {};
    for (const r of liCur) if (r.sku && !liProds[r.sku]) liProds[r.sku] = { id: r.sku, name: r.product_name, sku: r.sku, category: "", active: true };
    products = [...products, ...Object.values(liProds)];
    if (channelFilter) orders = orders.filter((o: any) => o.channel === channelFilter);
    if (saleFilter) orders = orders.filter((o: any) => o.salesperson_id === saleFilter);
    if (customerFilter) orders = orders.filter((o: any) => o.customer_id === customerFilter);
  } else {
    let q = sb.from("orders").select(`id, order_code, customer_id, salesperson_id, channel, sub_channel, gross_revenue, discount_value, shipping_cost, net_revenue, final_revenue, quantity, status, order_date, customers(full_name), users:salesperson_id(full_name)`).gte("order_date", from).lte("order_date", to).neq("status", "cancelled").neq("status", "refunded");
    if (channelFilter) q = q.eq("channel", channelFilter);
    if (subChannelFilter) q = q.eq("sub_channel", subChannelFilter);
    if (customerFilter) q = q.eq("customer_id", customerFilter);
    if (saleFilter) q = q.eq("salesperson_id", saleFilter);
    const [a, pb, pc, oi] = await Promise.all([
      q,
      sb.from("orders").select("final_revenue, gross_revenue, discount_value, shipping_cost, quantity, customer_id, salesperson_id").gte("order_date", prevFrom).lte("order_date", prevTo).neq("status", "cancelled").neq("status", "refunded"),
      sb.from("orders").select("final_revenue, customer_id").gte("order_date", prevYearFrom).lte("order_date", prevYearTo).neq("status", "cancelled").neq("status", "refunded"),
      sb.from("order_items").select("product_id, quantity, unit_price, subtotal, orders!inner(order_date, status, salesperson_id, sub_channel, customer_id)").gte("orders.order_date", from).lte("orders.order_date", to),
    ]);
    orders = a.data ?? []; prevOrders = pb.data ?? []; prevYearOrders = pc.data ?? []; orderItems = oi.data ?? [];
  }

  const filteredOrders = orders ?? [];

  const totalFinalRevenue = filteredOrders.reduce((s: number, o: any) => s + (o.final_revenue || 0), 0);
  const totalGrossRevenue = filteredOrders.reduce((s: number, o: any) => s + (o.gross_revenue || 0), 0);
  const totalDiscount = filteredOrders.reduce((s: number, o: any) => s + (o.discount_value || 0), 0);
  const totalNetRevenue = filteredOrders.reduce((s: number, o: any) => s + (o.net_revenue || 0), 0);
  const totalShipping = filteredOrders.reduce((s: number, o: any) => s + (o.shipping_cost || 0), 0);
  const totalQuantity = filteredOrders.reduce((s: number, o: any) => s + (o.quantity || 0), 0);
  const orderCount = filteredOrders.length;
  const uniqueCustomers = new Set(filteredOrders.map((o: any) => o.customer_id).filter(Boolean));
  const customerCount = uniqueCustomers.size;
  const productCount = (products ?? []).filter((p: any) => p.active).length;

  const prevTotal = (prevOrders ?? []).reduce((s: number, o: any) => s + (o.final_revenue || 0), 0);
  const prevDiscount = (prevOrders ?? []).reduce((s: number, o: any) => s + (o.discount_value || 0), 0);
  const prevOrderCount = (prevOrders ?? []).length;
  const prevYearTotal = (prevYearOrders ?? []).reduce((s: number, o: any) => s + (o.final_revenue || 0), 0);
  const prevCustomerSet = new Set((prevOrders ?? []).map((o: any) => o.customer_id).filter(Boolean));

  const newCustomers = Array.from(uniqueCustomers).filter(c => !prevCustomerSet.has(c)).length;
  const returningCustomers = customerCount - newCustomers;

  const courseRevenue = (students ?? []).reduce((s: number, x: any) => s + (x.paid_amount || 0), 0);

  const payrollCost = (payroll ?? []).reduce((s: number, p: any) => s + (p.total_company_cost || 0), 0);
  const bonusTotal = (payroll ?? []).reduce((s: number, p: any) => s + (p.bonus_amount || 0), 0);

  const misaByMonth: Record<string, number> = {};
  const liYear = await fetchLI("2026-01-01", "2026-12-31");
  for (const r of liYear) { const m = (r.order_date || "").slice(0, 7); if (m) misaByMonth[m] = (misaByMonth[m] || 0) + (r.net_amount || 0); }
  let ordYear: any[] = [], offY = 0;
  while (true) {
    const { data } = await sb.from("orders").select("gross_revenue, final_revenue, order_date")
      .gte("order_date", "2026-01-01").lte("order_date", "2026-12-31").neq("status", "cancelled").neq("status", "refunded").range(offY, offY + 999);
    if (!data || !data.length) break; ordYear = ordYear.concat(data); if (data.length < 1000) break; offY += 1000;
  }
  const ordersByMonth: Record<string, number> = {};
  for (const o of ordYear) { const m = o.order_date.slice(0, 7); ordersByMonth[m] = (ordersByMonth[m] || 0) + (o.gross_revenue || o.final_revenue || 0); }
  const monthActual: Record<string, number> = {};
  for (const m of new Set([...Object.keys(misaByMonth), ...Object.keys(ordersByMonth)])) monthActual[m] = misaByMonth[m] || ordersByMonth[m] || 0;
  const curMonth = vnDateStr().slice(0, 7);
  const annualTarget2026 = await getConfigNumber(CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026);
  const { rows: yearlyRows, ytdActual: ytdActual2026 } = buildMonthlyTargets2026(annualTarget2026, monthActual, curMonth);
  const targetByMonth: Record<string, number> = Object.fromEntries(yearlyRows.map(r => [r.month, r.target]));

  function periodTargetFor(fromStr: string, toStr: string): number {
    const f = new Date(fromStr + "T00:00:00Z"), t = new Date(toStr + "T00:00:00Z");
    let total = 0;
    let y = f.getUTCFullYear(), mo = f.getUTCMonth();
    while (y < t.getUTCFullYear() || (y === t.getUTCFullYear() && mo <= t.getUTCMonth())) {
      const ym = `${y}-${String(mo + 1).padStart(2, "0")}`;
      const mt = targetByMonth[ym] ?? ACME_TARGETS.monthlyRevenueTarget;
      const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      const mStart = new Date(Date.UTC(y, mo, 1)), mEnd = new Date(Date.UTC(y, mo, daysInMonth));
      const lo = f > mStart ? f : mStart, hi = t < mEnd ? t : mEnd;
      const daysInRange = Math.round((hi.getTime() - lo.getTime()) / 86400000) + 1;
      total += mt * (daysInRange / daysInMonth);
      mo++; if (mo > 11) { mo = 0; y++; }
    }
    return Math.round(total);
  }
  const periodTarget = periodTargetFor(from, to);

  const revenuePace = calcPace(totalFinalRevenue, daysElapsed, totalDays, periodTarget);
  const coursePace = calcPace(courseRevenue, daysElapsed, totalDays, ACME_TARGETS.monthlyCourseTarget);

  const productById: Record<string, any> = Object.fromEntries((products ?? []).map((p: any) => [p.id, p]));
  const productLineMap: Record<string, { line: string; info: any; revenue: number; qty: number; orderCount: Set<string> }> = {
    san_pham_a: { line: "san_pham_a", info: PRODUCT_LINE_INFO.san_pham_a, revenue: 0, qty: 0, orderCount: new Set() },
    NOVA: { line: "NOVA", info: PRODUCT_LINE_INFO.NOVA, revenue: 0, qty: 0, orderCount: new Set() },
    course: { line: "course", info: PRODUCT_LINE_INFO.course, revenue: 0, qty: 0, orderCount: new Set() },
    other: { line: "other", info: PRODUCT_LINE_INFO.other, revenue: 0, qty: 0, orderCount: new Set() }
  };
  (orderItems ?? []).forEach((it: any) => {
    const p = productById[it.product_id];
    if (!p) return;
    const line = classifyProductLine(p);
    productLineMap[line].revenue += it.subtotal || 0;
    productLineMap[line].qty += it.quantity || 0;
    if (it.orders?.id) productLineMap[line].orderCount.add(it.orders.id);
  });

  productLineMap.course.revenue += courseRevenue;
  const productLines = Object.values(productLineMap).map(p => ({
    ...p, orderCount: p.orderCount.size
  })).filter(p => p.revenue > 0 || p.qty > 0);

  const channelMap: Record<string, { name: string; count: number; revenue: number }> = {};
  const subChannelMap: Record<string, { name: string; count: number; revenue: number; avgRevenue: number; avgDiscount: number; totalDiscount: number }> = {};
  filteredOrders.forEach((o: any) => {
    const ch = o.channel || "Khác";
    channelMap[ch] = channelMap[ch] || { name: ch, count: 0, revenue: 0 };
    channelMap[ch].count += 1;
    channelMap[ch].revenue += o.final_revenue || 0;

    const sch = o.sub_channel || o.channel || "Khác";
    subChannelMap[sch] = subChannelMap[sch] || { name: sch, count: 0, revenue: 0, avgRevenue: 0, avgDiscount: 0, totalDiscount: 0 };
    subChannelMap[sch].count += 1;
    subChannelMap[sch].revenue += o.final_revenue || 0;
    subChannelMap[sch].totalDiscount += o.discount_value || 0;
  });
  Object.values(subChannelMap).forEach(s => {
    s.avgRevenue = s.count > 0 ? s.revenue / s.count : 0;
    s.avgDiscount = s.count > 0 ? s.totalDiscount / s.count : 0;
  });
  const channels = Object.values(channelMap).sort((a, b) => b.count - a.count);
  const subChannels = Object.values(subChannelMap).sort((a, b) => b.avgRevenue - a.avgRevenue);
  const allChannels = Array.from(new Set(filteredOrders.map((o: any) => o.channel).filter(Boolean)));
  const allSubChannels = Array.from(new Set(filteredOrders.map((o: any) => o.sub_channel).filter(Boolean)));

  const dailyMap: Record<string, { date: string; revenue: number; orders: number; cumRevenue: number }> = {};
  const fillDays = () => {
    const d1 = new Date(from), d2 = new Date(to);
    while (d1 <= d2) {
      const k = d1.toISOString().slice(0, 10);
      dailyMap[k] = { date: k, revenue: 0, orders: 0, cumRevenue: 0 };
      d1.setDate(d1.getDate() + 1);
    }
  };
  fillDays();
  filteredOrders.forEach((o: any) => {
    const k = o.order_date;
    if (!dailyMap[k]) return;
    dailyMap[k].revenue += o.final_revenue || 0;
    dailyMap[k].orders += 1;
  });
  const dailySeries = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  let cum = 0;
  dailySeries.forEach(d => { cum += d.revenue; d.cumRevenue = cum; });

  const quarterMap: Record<string, { period: string; revenue: number; orders: number }> = {};
  filteredOrders.forEach((o: any) => {
    const d = new Date(o.order_date);
    const key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    quarterMap[key] = quarterMap[key] || { period: key, revenue: 0, orders: 0 };
    quarterMap[key].revenue += o.final_revenue || 0;
    quarterMap[key].orders += 1;
  });
  const quarterSeries = Object.values(quarterMap).sort((a, b) => a.period.localeCompare(b.period));

  const saleMap: Record<string, { id: string; name: string; orders: number; revenue: number; pct: number; status: string }> = {};
  filteredOrders.forEach((o: any) => {
    if (!o.salesperson_id) return;
    const name = o.users?.full_name || "—";
    saleMap[o.salesperson_id] = saleMap[o.salesperson_id] || { id: o.salesperson_id, name, orders: 0, revenue: 0, pct: 0, status: "" };
    saleMap[o.salesperson_id].orders += 1;
    saleMap[o.salesperson_id].revenue += o.final_revenue || 0;
  });
  Object.values(saleMap).forEach(s => {

    const isLead = /lead|leader/i.test((salesUsers ?? []).find((u: any) => u.id === s.id)?.position || "");
    const target = isLead ? ACME_TARGETS.saleLeaderTarget : ACME_TARGETS.saleIndividualTarget;
    s.pct = target > 0 ? (s.revenue / target) * 100 : 0;
    s.status = s.pct >= 100 ? "" : s.pct >= 70 ? "" : "";
  });
  const topSales = Object.values(saleMap).sort((a, b) => b.revenue - a.revenue);

  const productMap: Record<string, { name: string; sku: string; revenue: number; qty: number }> = {};
  (orderItems ?? []).forEach((it: any) => {
    const p = productById[it.product_id];
    if (!p) return;
    productMap[it.product_id] = productMap[it.product_id] || { name: p.name, sku: p.sku || "", revenue: 0, qty: 0 };
    productMap[it.product_id].revenue += it.subtotal || 0;
    productMap[it.product_id].qty += it.quantity || 0;
  });
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const delta = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

  const estimatedCOGS = totalGrossRevenue * 0.5;
  const grossProfit = totalGrossRevenue - estimatedCOGS - totalDiscount - totalShipping;
  const marginPct = totalGrossRevenue > 0 ? (grossProfit / totalGrossRevenue) * 100 : 0;

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-[#F5C518]"></span> ACME BI Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {t("Kỳ:")} <b>{t(label)}</b> ({from} → {to}) · {t("ngày")} {daysElapsed}/{totalDays}
          </p>
        </div>
        <FilterBar
          currentRange={range}
          currentChannel={channelFilter}
          currentSubChannel={subChannelFilter}
          currentProduct={productFilter}
          currentCustomer={customerFilter}
          currentSale={saleFilter}
          availableChannels={allChannels}
          availableSubChannels={allSubChannels}
          products={products ?? []}
          customers={customers ?? []}
          sales={(salesUsers ?? []).filter((u: any) => /sale|lead/i.test(u.position || ""))}
        />
      </div>

      <YearlyTarget rows={yearlyRows} annualTarget={annualTarget2026} ytdActual={ytdActual2026} canEdit={canEditTarget} />

      <DashboardTabs
        currentTab={tab}
        data={{

          totalFinalRevenue, totalGrossRevenue, totalDiscount, totalNetRevenue, totalShipping, totalQuantity,
          orderCount, customerCount, productCount,
          newCustomers, returningCustomers,
          courseRevenue, payrollCost, bonusTotal,
          cheBod,

          prevTotal, prevDiscount, prevOrderCount, prevYearTotal,

          deltaRevenue: delta(totalFinalRevenue, prevTotal),
          deltaYoY: delta(totalFinalRevenue, prevYearTotal),
          deltaOrders: delta(orderCount, prevOrderCount),

          revenuePace, coursePace,

          targets: { ...ACME_TARGETS, monthlyRevenueTarget: periodTarget },

          estimatedCOGS, grossProfit, marginPct,
          payrollPct: totalFinalRevenue > 0 ? (payrollCost / totalFinalRevenue) * 100 : 0,

          productLines,
          channels, subChannels,
          dailySeries, quarterSeries,
          topProducts, topSales
        }}
      />
    </div>
  );
}
