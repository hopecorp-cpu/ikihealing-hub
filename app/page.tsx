import { redirect } from "next/navigation";
import { getCurrentUser, getServerClient, getServiceClient } from "@/lib/supabase-server";
import { fmtVND, vnDateStr, fmtTimeVN } from "@/lib/payroll";
import { isAdmin as roleIsAdmin, isBodRole, isManagerOrAbove } from "@/lib/auth";
import { monthRange } from "@/lib/date-range";
import { layDoanhThu } from "@/lib/doanh-thu";

const truNgay = (iso: string) => new Date(new Date(iso).getTime() - 864e5).toISOString().slice(0, 10);
import { getAdminReminders } from "@/lib/admin-reminders";
import { AdminAssistant } from "@/components/admin-assistant";
import { getT } from "@/lib/i18n-server";
import MyDay from "./MyDay";
import { MetricCard, CapacityCard, Donut, DonutLegend, MiniAreaChart, Pipeline, ActivityFeed, Panel } from "@/components/dashboard-ui";
import {
  Users, Building2, BarChart3, Clock, ShoppingCart, GraduationCap, FileText,
  Briefcase, FolderKanban, TrendingUp, Award, AlertTriangle, Sparkles,
  Wallet, Target, CalendarOff, CheckCircle2, ScanFace, Heart, PieChart, Activity, Filter, MessageSquare
} from "lucide-react";
import Link from "next/link";

const CHANNEL_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4", "#94A3B8"];

const pctDelta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

function mocCungKy(today: string) {
  const dayNum = Number(today.slice(8, 10));
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const lastMonth = `${py}-${String(pm).padStart(2, "0")}`;
  const soNgayThangTruoc = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const d = Math.min(dayNum, soNgayThangTruoc);
  return { dayNum, lastMonth, lmSameDayEnd: `${lastMonth}-${String(d).padStart(2, "0")}` };
}

export const dynamic = "force-dynamic";

export default async function Page() {
  const { t } = getT();

  const user = await getCurrentUser();
  if (!user) {
    const { data: { user: authUser } } = await getServerClient().auth.getUser();
    if (!authUser) redirect("/login");
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-white border border-yellow-200 rounded-xl p-8">
        <div className="text-5xl mb-4 text-center"></div>
        <h1 className="text-xl font-bold mb-2 text-center">{t("Chào")} {authUser.email}!</h1>
        <p className="text-gray-600 mb-4 text-center">
          {t("Tài khoản này hiện")} <b>{t("chưa được cấp quyền hoặc đã ngừng hoạt động")}</b>.<br/>
          {t("Nếu anh/chị vẫn đang làm việc tại công ty, vui lòng liên hệ HR.")}
        </p>
      </div>
    );
  }

  const isAdmin = roleIsAdmin(user.role);
  const isManager = isManagerOrAbove(user.role);
  const bod = isBodRole(user.role);

  if (bod) return <AdminHome user={user} isAdmin={false} bod />;
  if (!isManager) return <EmployeeHome user={user} />;
  return <AdminHome user={user} isAdmin={isAdmin} />;
}

async function EmployeeHome({ user }: { user: any }) {
  const { t } = getT();
  const sb = getServiceClient();
  const today = vnDateStr();
  const month = today.slice(0, 7);
  const { lastMonth, lmSameDayEnd } = mocCungKy(today);

  const [
    { data: attendanceMonth },
    { data: attendanceLastPace },
    { data: todayAtt },
    { data: latestPayslip },
    { data: myKpis },
    { data: myLeaves }
  ] = await Promise.all([
    sb.from("attendance").select("date,status,late_minutes,early_leave_minutes,check_in_time,check_out_time")
      .eq("user_id", user.id).gte("date", `${month}-01`).lt("date", monthRange(month).nextStart),

    sb.from("attendance").select("late_minutes,check_in_time")
      .eq("user_id", user.id).gte("date", `${lastMonth}-01`).lte("date", lmSameDayEnd),
    sb.from("attendance").select("check_in_time,check_out_time,status,late_minutes,early_leave_minutes,work_location")
      .eq("user_id", user.id).eq("date", today).maybeSingle(),
    sb.from("payroll").select("month,gross_salary,net_salary,bonus_amount,status")
      .eq("user_id", user.id).order("month", { ascending: false }).limit(3),
    sb.from("kpis").select("name,target_value,current_value,metric_unit,status")
      .eq("user_id", user.id).eq("status", "active").limit(5),
    sb.from("leaves").select("start_date,end_date,leave_type,status,total_days")
      .eq("user_id", user.id).gte("start_date", new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
      .order("start_date", { ascending: false }).limit(5)
  ]);

  const ncMonth = (attendanceMonth ?? []).filter((a: any) => a.check_in_time).length;
  const totalLate = (attendanceMonth ?? []).reduce((s: number, a: any) => s + (a.late_minutes || 0), 0);
  const totalEarly = (attendanceMonth ?? []).reduce((s: number, a: any) => s + (a.early_leave_minutes || 0), 0);
  const pendingLeaves = (myLeaves ?? []).filter((l: any) => l.status === "pending").length;
  const currentPayslip = (latestPayslip ?? [])[0];

  const ncLastPace = (attendanceLastPace ?? []).filter((a: any) => a.check_in_time).length;
  const lateLastPace = (attendanceLastPace ?? []).reduce((s: number, a: any) => s + (a.late_minutes || 0), 0);
  const prevPayslip = (latestPayslip ?? [])[1];

  const lateDelta = pctDelta(totalLate, lateLastPace);
  const netDelta = currentPayslip && prevPayslip ? pctDelta(currentPayslip.net_salary || 0, prevPayslip.net_salary || 0) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("Xin chào,")} {user.full_name} </h1>
        <p className="text-sm text-gray-500 mt-1">
          {user.position} · {t("Hôm nay")} {today} · {t("Tháng")} <b>{month}</b>
        </p>
      </div>

      <MyDay user={user} />

      <div className="bg-gradient-to-br from-[#0B1F14] to-[#143020] rounded-2xl p-6 text-white">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <div className="text-sm text-gray-400">{t("Chấm công hôm nay")}</div>
            {todayAtt ? (
              <div className="text-2xl font-bold mt-1">
                {t("Vào:")} <span className="text-[#F5C518]">{fmtTimeVN(todayAtt.check_in_time)}</span>
                <span className="text-gray-500 mx-3">·</span>
                {t("Ra:")} <span className="text-orange-400">{fmtTimeVN(todayAtt.check_out_time)}</span>
              </div>
            ) : (
              <div className="text-xl mt-1 text-gray-300">{t("Chưa chấm công hôm nay")}</div>
            )}
          </div>
          <Link href="/cham-cong" className="px-5 py-2.5 bg-[#F5C518] text-[#0B1F14] rounded-md font-bold flex items-center gap-2">
            <ScanFace className="w-5 h-5" /> {t("Chấm công Face ID")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CapacityCard label={t("NGÀY CÔNG THÁNG")} current={ncMonth} capacity={26} unit={t(" ngày")} mocKyVong={ncLastPace}
          note={`${t("cùng kỳ T")}${lastMonth.slice(5)}: ${ncLastPace}`} color="#10B981" icon={CheckCircle2} />
        <MetricCard label={t("ĐI MUỘN")} value={`${totalLate}p`} delta={lateDelta} deltaGoodWhenUp={false}
          sub={`${t("cùng kỳ")} ${lateLastPace}p`} color={totalLate > 0 ? "#EF4444" : "#10B981"} icon={Clock} />
        <MetricCard label={t("THỰC LĨNH GẦN NHẤT")} value={currentPayslip ? fmtVND(currentPayslip.net_salary) : "—"} delta={netDelta}
          sub={currentPayslip?.month || t("Chưa chốt")} color="#8B5CF6" icon={Wallet} />
        <MetricCard label={t("ĐƠN NGHỈ")} value={String(pendingLeaves)} sub={t("đang chờ duyệt")} color="#F59E0B" icon={CalendarOff} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-purple-600" /> {t("KPI của tôi")}</h3>
          {(myKpis ?? []).length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">{t("Chưa có KPI active")}</div>
          ) : (
            <div className="space-y-3">
              {(myKpis ?? []).map((k: any) => {
                const pct = k.target_value > 0 ? Math.min(100, (k.current_value / k.target_value) * 100) : 0;
                return (
                  <div key={k.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{k.name}</span>
                      <span className="text-gray-600 tabular-nums">{k.current_value}/{k.target_value} {k.metric_unit}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-blue-500" : "bg-orange-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/kpi" className="text-xs text-brand-600 mt-3 inline-block hover:underline">{t("Xem chi tiết →")}</Link>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-600" /> {t("Phiếu lương 3 tháng gần")}</h3>
          {(latestPayslip ?? []).length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">{t("Chưa có phiếu lương")}</div>
          ) : (
            <div className="space-y-2">
              {(latestPayslip ?? []).map((p: any) => (
                <div key={p.month} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">{p.month}</span>
                  <span className="text-sm tabular-nums text-emerald-700 font-semibold">{fmtVND(p.net_salary)}</span>
                  <span className="text-xs text-gray-500">{p.status}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/phieu-luong" className="text-xs text-brand-600 mt-3 inline-block hover:underline">{t("Xem chi tiết →")}</Link>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold flex items-center gap-2"><CalendarOff className="w-4 h-4 text-orange-500" /> {t("Đơn xin nghỉ gần đây")}</h3>
          <Link href="/xin-nghi" className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg font-medium">{t("+ Xin nghỉ mới")}</Link>
        </div>
        {(myLeaves ?? []).length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">{t("Chưa có đơn nghỉ nào")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase">
              <tr><th className="text-left py-1">{t("Từ")}</th><th className="text-left py-1">{t("Đến")}</th><th className="text-left py-1">{t("Loại")}</th><th className="text-right py-1">{t("Số ngày")}</th><th className="text-left py-1 pl-3">{t("Trạng thái")}</th></tr>
            </thead>
            <tbody>
              {(myLeaves ?? []).map((l: any, i: number) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-2">{l.start_date}</td>
                  <td className="py-2">{l.end_date}</td>
                  <td className="py-2 text-xs">{l.leave_type}</td>
                  <td className="py-2 text-right">{l.total_days}</td>
                  <td className="py-2 pl-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      l.status === "approved" ? "bg-green-100 text-green-700" :
                      l.status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{l.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

async function AdminHome({ user, isAdmin, bod = false }: { user: any; isAdmin: boolean; bod?: boolean }) {
  const { t } = getT();
  const sb = getServiceClient();
  const today = vnDateStr();
  const month = today.slice(0, 7);

  const { dayNum, lastMonth, lmSameDayEnd } = mocCungKy(today);

  const ydDate = new Date(`${today}T00:00:00Z`);
  ydDate.setUTCDate(ydDate.getUTCDate() - 1);
  const yesterday = ydDate.toISOString().slice(0, 10);

  const [
    { count: empCount },
    { data: cycles },
    { data: ordersThisMonth },
    { data: ordersLastMonthPace },
    { count: studentCount },
    { data: studentRevenue },
    { count: contentCount },
    { count: candidatesCount },
    { count: projectCount },
    { data: activeProjects },
    { data: thisMonthPayroll },
    { data: lastMonthPayroll },
    { count: pendingLeaves },
    { data: kpisOnTrack },
    { data: recentLeaves },
    { data: itemsToday },
    { data: itemsYesterday }
  ] = await Promise.all([
    sb.from("users").select("*", { count: "exact", head: true }).eq("active", true),
    sb.from("cycles").select("*").order("start_date", { ascending: false }).limit(3),

    layDoanhThu(sb, `${month}-01`, truNgay(monthRange(month).nextStart)).then((r) => ({ data: r.rows })),
    layDoanhThu(sb, `${lastMonth}-01`, lmSameDayEnd).then((r) => ({ data: r.rows })),
    sb.from("students").select("*", { count: "exact", head: true }),
    sb.from("students").select("paid_amount"),
    sb.from("content_items").select("*", { count: "exact", head: true }).eq("status", "published"),
    sb.from("candidates").select("*", { count: "exact", head: true }).in("status", ["new", "screening", "interview", "offer"]),
    sb.from("projects").select("*", { count: "exact", head: true }),
    sb.from("projects").select("*").eq("status", "active").limit(5),
    bod ? Promise.resolve({ data: [] }) : sb.from("payroll").select("net_salary, total_company_cost, bonus_amount").eq("month", month),

    bod ? Promise.resolve({ data: [] }) : sb.from("payroll").select("total_company_cost").eq("month", lastMonth),
    sb.from("leaves").select("*", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("kpis").select("status").eq("status", "active"),
    sb.from("leaves").select("leave_type, start_date, status").order("start_date", { ascending: false }).limit(4),
    layDoanhThu(sb, today, today).then((r) => ({ data: r.rows })),
    layDoanhThu(sb, yesterday, yesterday).then((r) => ({ data: r.rows }))
  ]);

  let leadPipe = { moi: 0, lienHe: 0, chot: 0 };

  const [leadKq, reminders] = await Promise.all([
    Promise.resolve(sb.from("leads").select("status").eq("month", month)).catch(() => ({ data: null })),
    isAdmin ? getAdminReminders() : Promise.resolve([] as Awaited<ReturnType<typeof getAdminReminders>>),
  ]);
  try {
    const { data: leadRows } = leadKq;
    for (const l of (leadRows ?? []) as any[]) {
      const st = String(l.status || "").toLowerCase();
      if (st === "won" || st === "chot" || st === "chốt") leadPipe.chot++;
      else if (st === "contacted" || st === "lien_he" || st.includes("liên")) leadPipe.lienHe++;
      else leadPipe.moi++;
    }
  } catch { }

  const totalRevenue = (ordersThisMonth ?? []).reduce((s: number, o: any) => s + (o.net_amount || 0), 0);
  const totalOrders = new Set((ordersThisMonth ?? []).map((o: any) => o.order_code)).size;
  const totalStudentRev = (studentRevenue ?? []).reduce((s: number, x: any) => s + (x.paid_amount || 0), 0);
  const totalCost = (thisMonthPayroll ?? []).reduce((s: number, p: any) => s + (p.total_company_cost || 0), 0);
  const payrollToRevenue = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

  const revLastPace = (ordersLastMonthPace ?? []).reduce((s: number, o: any) => s + (o.net_amount || 0), 0);
  const ordLastPace = new Set((ordersLastMonthPace ?? []).map((o: any) => o.order_code)).size;
  const revDelta = pctDelta(totalRevenue, revLastPace);
  const ordDelta = pctDelta(totalOrders, ordLastPace);

  const totalCostLast = (lastMonthPayroll ?? []).reduce((s: number, p: any) => s + (p.total_company_cost || 0), 0);
  const costDelta = totalCost > 0 ? pctDelta(totalCost, totalCostLast) : null;

  const revToday = (itemsToday ?? []).reduce((s: number, o: any) => s + (o.net_amount || 0), 0);
  const ordersToday = new Set((itemsToday ?? []).map((o: any) => o.order_code)).size;
  const aovToday = ordersToday > 0 ? revToday / ordersToday : 0;
  const revYesterday = (itemsYesterday ?? []).reduce((s: number, o: any) => s + (o.net_amount || 0), 0);
  const ordersYesterday = new Set((itemsYesterday ?? []).map((o: any) => o.order_code)).size;
  const aovYesterday = ordersYesterday > 0 ? revYesterday / ordersYesterday : 0;
  const revTodayDelta = pctDelta(revToday, revYesterday);
  const ordTodayDelta = pctDelta(ordersToday, ordersYesterday);
  const aovTodayDelta = pctDelta(aovToday, aovYesterday);
  const topByProduct: Record<string, { qty: number; rev: number }> = {};
  (itemsToday ?? []).forEach((o: any) => {
    const name = o.product_name || "?";
    if (!topByProduct[name]) topByProduct[name] = { qty: 0, rev: 0 };
    topByProduct[name].qty += o.quantity || 0;
    topByProduct[name].rev += o.net_amount || 0;
  });
  const topToday = Object.entries(topByProduct).sort((a, b) => b[1].rev - a[1].rev).slice(0, 3);

  const CHUAN_SHIP: Record<string, string> = { da_ck: "ck_truoc", khach_tra: "khach_tra_ship" };
  const TEN_SHIP: Record<string, string> = {
    cod: "COD (thu khi giao)", ck_truoc: "CK trước", freeship: "Freeship", khach_tra_ship: "Khách trả ship",
  };
  const nhanShip = (v: any) => {
    const raw = String(v || "").trim();
    if (!raw) return t("Chưa ghi");
    const k = CHUAN_SHIP[raw] ?? raw;
    return TEN_SHIP[k] || k;
  };
  const byShip: Record<string, number> = {};
  (ordersThisMonth ?? []).forEach((o: any) => {
    const k = nhanShip(o.kieu_ship);
    byShip[k] = (byShip[k] || 0) + (o.net_amount || 0);
  });
  const shipSegs = Object.entries(byShip).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, value], i) => ({ label, value, color: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }));

  const dailyRev: number[] = Array.from({ length: dayNum }, () => 0);
  (ordersThisMonth ?? []).forEach((o: any) => {
    const d = Number(String(o.order_date).slice(8, 10));
    if (d >= 1 && d <= dayNum) dailyRev[d - 1] += o.net_amount || 0;
  });

  const orderAgg: Record<string, { amount: number; date: string; ch: string }> = {};
  (ordersThisMonth ?? []).forEach((o: any) => {
    const k = o.order_code || "?";

    if (!orderAgg[k]) orderAgg[k] = { amount: 0, date: o.order_date, ch: o.kieu_ship ? nhanShip(o.kieu_ship) : (o.sale_channel || "—") };
    orderAgg[k].amount += o.net_amount || 0;
    if (String(o.order_date) > String(orderAgg[k].date)) orderAgg[k].date = o.order_date;
  });
  const recentOrders = Object.entries(orderAgg).sort((a, b) => String(b[1].date).localeCompare(String(a[1].date))).slice(0, 5);
  const activity = [
    ...recentOrders.map(([code, o]) => ({ icon: "", color: "#10B981", text: `Đơn ${code} · ${o.ch}`, time: `${fmtVND(o.amount)} · ${o.date}`, href: bod ? "/dashboard" : "/sales" })),
    ...((recentLeaves ?? []) as any[]).slice(0, bod ? 0 : 2).map((l) => ({ icon: "", color: "#F59E0B", text: `Đơn nghỉ ${l.leave_type || ""}`, time: `${l.start_date} · ${l.status}`, href: "/xin-nghi" })),
  ].slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("Tổng quan ACME Corp")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("Chào")} {user.full_name} · {user.position} · {t("Tháng")} <b>{month}</b>
          </p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-semibold shadow hover:shadow-md transition">
          <BarChart3 className="w-4 h-4" /> {t("Mở Dashboard BI →")}
        </Link>
      </div>

      {!bod && <MyDay user={user} />}

      {isAdmin && <AdminAssistant reminders={reminders} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label={t("DOANH THU HÔM NAY")} value={fmtVND(revToday)} delta={revTodayDelta}
          sub={`${t("hôm qua")} ${fmtVND(revYesterday)}`} color="#10B981" icon={Wallet} />
        <MetricCard label={t("ĐƠN HÔM NAY")} value={String(ordersToday)} delta={ordTodayDelta}
          sub={`${t("hôm qua")} ${ordersYesterday}`} color="#3B82F6" icon={ShoppingCart} sensitive={false} />
        <MetricCard label={t("TB/ĐƠN HÔM NAY")} value={ordersToday > 0 ? fmtVND(aovToday) : "—"} delta={aovTodayDelta}
          sub={ordersYesterday > 0 ? `${t("hôm qua")} ${fmtVND(aovYesterday)}` : t("giá trị TB hóa đơn")} color="#8B5CF6" icon={BarChart3} />
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          <div className="flex items-start justify-between">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t("TOP SP HÔM NAY")}</div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#F59E0B16" }}>
              <Award className="w-[18px] h-[18px]" style={{ color: "#F59E0B" }} />
            </div>
          </div>
          {topToday.length === 0 ? (
            <div className="text-sm text-gray-400 mt-3">{t("Chưa có đơn hôm nay")}</div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {topToday.map(([name, v], i) => (
                <div key={name} className="flex items-center gap-2 text-[13px]">
                  <span className="text-gray-400 tabular-nums w-3 shrink-0">{i + 1}.</span>
                  <span className="text-gray-700 truncate flex-1" title={name}>{name}</span>
                  <span className="text-gray-500 tabular-nums shrink-0">{v.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label={t("DOANH THU")} value={fmtVND(totalRevenue)} delta={revDelta} sub={`${t("so cùng kỳ T")}${lastMonth.slice(5)}`} color="#10B981" icon={TrendingUp} />
        <MetricCard label={t("DT KHOÁ HỌC")} value={fmtVND(totalStudentRev)} sub={`${studentCount} HV · ${t("luỹ kế")}`} color="#8B5CF6" icon={GraduationCap} />
        {isAdmin && <MetricCard label={t("QUỸ LƯƠNG")} value={fmtVND(totalCost)} delta={costDelta} deltaGoodWhenUp={false}
          sub={totalCost > 0 ? `${empCount} NV · ${t("so T")}${lastMonth.slice(5)}` : t("tháng này chưa chốt")} color="#F59E0B" icon={Users} />}
        {isAdmin && <CapacityCard label={t("LƯƠNG / DOANH THU")} current={Number(payrollToRevenue.toFixed(1))} capacity={50} unit="%"
          fullIsGood={false} sensitive
          note={totalCost > 0 ? t("trần 50%") : t("chưa chốt lương tháng")} color="#EF4444" icon={BarChart3} />}
        {!isAdmin && !bod && <MetricCard label={t("DỰ ÁN ACTIVE")} value={String(activeProjects?.length ?? 0)} sub={t("đang chạy")} color="#06B6D4" icon={FolderKanban} />}
        {!isAdmin && !bod && <MetricCard label={t("ỨNG VIÊN")} value={String(candidatesCount ?? 0)} sub={t("đang xử lý")} color="#F59E0B" icon={Briefcase} />}
        {bod && <MetricCard label={t("ĐƠN TRONG THÁNG")} value={String(totalOrders)} sub={t("sổ doanh thu")} color="#3B82F6" icon={ShoppingCart} sensitive={false} />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {bod ? (
          <>
            <ModuleCard href="/dashboard" label="Dashboard BI" icon={BarChart3} count={totalOrders} color="#1a73e8" />
            <ModuleCard href="/chi-so" label={t("Bảng chỉ số")} icon={PieChart} count={null} color="#8B5CF6" />
            <ModuleCard href="/bao-cao-thang" label={t("Báo cáo tháng")} icon={FileText} count={null} color="#10B981" />
            <ModuleCard href="/gop-y-bod" label={t("Góp ý BOD")} icon={MessageSquare} count={null} color="#F59E0B" />
          </>
        ) : (
          <>
            <ModuleCard href="/sales" label={t("Bán hàng")} icon={ShoppingCart} count={totalOrders} color="#1a73e8" />
            <ModuleCard href="/hoc-vien" label={t("Học viên")} icon={GraduationCap} count={studentCount ?? 0} color="#8B5CF6" />
            <ModuleCard href="/content" label="Content" icon={FileText} count={contentCount ?? 0} color="#EC4899" />
            <ModuleCard href="/tuyen-dung" label={t("Tuyển dụng")} icon={Briefcase} count={candidatesCount ?? 0} color="#F59E0B" />
            <ModuleCard href="/du-an" label={t("Dự án")} icon={FolderKanban} count={projectCount ?? 0} color="#06B6D4" />
            {isAdmin && <ModuleCard href="/nhan-su" label={t("Nhân sự")} icon={Users} count={empCount ?? 0} color="#10B981" />}
            {isAdmin && <ModuleCard href="/bang-luong" label={t("Bảng lương")} icon={Award} count={null} color="#84CC16" />}
          </>
        )}
      </div>

      <Panel title={t("Doanh thu tháng này")} icon={TrendingUp} iconColor="#10B981" action={{ label: t("Chi tiết BI →"), href: "/dashboard" }}>
        <div className="flex items-end justify-between gap-4 mb-2">
          <div>
            <div className="sensitive text-2xl font-bold text-gray-900 tabular-nums">{fmtVND(totalRevenue)}</div>
            <div className="text-[12px] text-gray-400 mt-0.5">
              {totalOrders} {t("đơn")}
              {ordDelta != null && <span className={ordDelta >= 0 ? "text-emerald-600" : "text-rose-600"}> ({ordDelta >= 0 ? "+" : ""}{ordDelta.toFixed(0)}%)</span>}
              {" · "}{t("đến ngày")} {dayNum}
            </div>
          </div>
          {revDelta != null && (
            <div className="text-right">
              <div className={`text-sm font-semibold ${revDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{revDelta >= 0 ? "▲" : "▼"} {Math.abs(revDelta).toFixed(0)}%</div>
              <div className="text-[11px] text-gray-400">{t("so cùng kỳ T")}{lastMonth.slice(5)}</div>
            </div>
          )}
        </div>
        <MiniAreaChart points={dailyRev} />
        {(leadPipe.moi + leadPipe.lienHe + leadPipe.chot) > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" />{t("Pipeline bán hàng")}</div>
            <Pipeline stages={[
              { label: t("Lead mới"), count: leadPipe.moi, color: "#3B82F6" },
              { label: t("Đã liên hệ"), count: leadPipe.lienHe, color: "#F59E0B" },
              { label: t("Chốt đơn"), count: leadPipe.chot, color: "#10B981" },
            ]} />
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title={t("Hình thức đơn")} icon={PieChart} iconColor="#8B5CF6">
          {shipSegs.length ? (
            <>
              <div className="flex items-center gap-4">
                <Donut segments={shipSegs} centerLabel={String(totalOrders)} centerSub={t("đơn")} />
                <DonutLegend segments={shipSegs} sum={totalRevenue} fmt={fmtVND} />
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 text-[11px] text-gray-400 leading-relaxed">
                {t("Nhãn ghi tay trong sổ đơn, mỗi đơn chỉ có một nhãn và nhãn trộn cả cách thu tiền lẫn ai trả phí ship. Đừng đọc lát CK trước thành tỉ lệ khách trả trước — số đó lấy từ sao kê ngân hàng.")}
              </div>
            </>
          ) : <div className="text-center py-8 text-gray-400 text-sm">{t("Chưa có đơn tháng này")}</div>}
        </Panel>

        <Panel title={t("Hoạt động gần đây")} icon={Activity} iconColor="#3B82F6">
          <ActivityFeed items={activity} />
        </Panel>

        <Panel title={t("Cần xử lý")} icon={AlertTriangle} iconColor="#F59E0B">
          <div className="space-y-1">
            <AlertRow icon="" label={t("Đơn nghỉ chờ duyệt")} count={pendingLeaves ?? 0} href="/xin-nghi" color="yellow" />
            <AlertRow icon="" label={t("KPI đang active")} count={kpisOnTrack?.length ?? 0} href="/kpi" color="blue" />
            <AlertRow icon="" label={t("Ứng viên đang xử lý")} count={candidatesCount ?? 0} href="/tuyen-dung" color="purple" />
            <AlertRow icon="" label={t("Dự án đang chạy")} count={activeProjects?.length ?? 0} href="/du-an" color="green" />
            <AlertRow icon="" label={t("Học viên đang học")} count={studentCount ?? 0} href="/hoc-vien" color="indigo" />
          </div>
        </Panel>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-semibold mb-3">{t("Chu kỳ KPI")}</h3>
        <div className="space-y-2">
          {(cycles ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{c.start_date} → {c.end_date}</div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {c.status === "active" ? t("Đang chạy") : c.status}
              </span>
            </div>
          ))}
          {(!cycles || cycles.length === 0) && (
            <div className="text-center py-8 text-gray-400 text-sm">{t("Chưa có chu kỳ — vào /chu-ky tạo")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ href, label, icon: Icon, count, color }: any) {
  return (
    <Link href={href} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 hover:shadow-md transition flex flex-col items-center text-center group">
      <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition" style={{ backgroundColor: color + "22" }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div className="text-sm font-medium">{label}</div>
      {count !== null && <div className="text-xs text-gray-500 mt-0.5">{count}</div>}
    </Link>
  );
}

function AlertRow({ icon, label, count, href, color }: any) {
  const dot: any = {
    yellow: "bg-yellow-500", blue: "bg-blue-500", purple: "bg-purple-500",
    green: "bg-green-500", indigo: "bg-indigo-500",
  };
  const colors: any = {
    yellow: "bg-yellow-50 text-yellow-700", blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700", green: "bg-green-50 text-green-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };
  return (
    <Link href={href} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot[color] || "bg-gray-400"}`} />
      {icon && <span className="text-xl">{icon}</span>}
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
      </div>
      <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${colors[color] || ""}`}>{count}</span>
    </Link>
  );
}
