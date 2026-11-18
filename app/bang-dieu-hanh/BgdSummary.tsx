import { getServiceClient } from "@/lib/supabase-server";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { getConfigNumber, getConfigValue } from "@/lib/app-config";
import { CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026, buildMonthlyTargets2026 } from "@/lib/bi-targets";
import finance from "@/data/finance-data.json";
import stockData from "@/data/warehouse-stock.json";
import { getT } from "@/lib/i18n-server";
import { fmtMoneyL, mlabel } from "@/lib/i18n";
import BgdAiPanel from "./BgdAiPanel";
import { layDoanhThu, tuoiNguonDon } from "@/lib/doanh-thu";

export default async function BgdSummary({ month }: { month: string }) {
  const sb = getServiceClient();
  const [y, mo] = month.split("-").map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const todayStr = vnDateStr();
  const daysElapsed = todayStr.slice(0, 7) === month ? +todayStr.slice(8, 10) : daysInMonth;
  const expectedPct = Math.round(daysElapsed / daysInMonth * 100);

  const li = (await layDoanhThu(sb, `${month}-01`, `${month}-${String(daysInMonth).padStart(2, "0")}`)).rows;
  const saleRev = li.reduce((s, r) => s + (r.net_amount || 0), 0);
  const saleOrders = new Set(li.map(r => r.order_code)).size;
  const saleCustomers = new Set(li.map(r => r.customer_phone).filter(Boolean)).size;
  const annualTarget = await getConfigNumber(CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026);
  const { rows: tRows } = buildMonthlyTargets2026(annualTarget, { [month]: saleRev }, month);
  const saleTarget = tRows.find(r => r.month === month)?.target || 0;
  const salePct = saleTarget > 0 ? Math.round(saleRev / saleTarget * 100) : 0;

  const pnl: any[] = (finance as any).pnl || [];
  const fin = pnl.find(p => p.month === month) || pnl[pnl.length - 1] || null;
  const finIsCurrent = fin && fin.month === month;

  const [{ data: users }, { data: payroll }] = await Promise.all([
    sb.from("users").select("id, active").eq("active", true),
    sb.from("payroll").select("total_company_cost").eq("month", month),
  ]);
  const headcount = (users ?? []).length;
  const payrollCost = (payroll ?? []).reduce((s, p) => s + (p.total_company_cost || 0), 0);

  const stockItems = (stockData as any).items as { closing: number }[];
  const lowStock = stockItems.filter(s => s.closing > 0 && s.closing <= 10).length;
  const outStock = stockItems.filter(s => s.closing <= 0).length;
  const { count: jtReturns } = await sb.from("jt_waybills").select("*", { count: "exact", head: true })
    .eq("status_group", "returned").gte("order_create_time", `${month}-01 00:00:00`).lte("order_create_time", `${month}-${String(daysInMonth).padStart(2, "0")} 23:59:59`);

  const alerts: string[] = [];
  if (saleTarget > 0 && salePct < expectedPct - 5) alerts.push(`Doanh số đang CHẬM nhịp: ${salePct}% KPI trong khi đã qua ${expectedPct}% tháng.`);
  if (fin && fin.profit < 0) alerts.push(`Tài chính ${fin.label}: LỖ ${fmtVND(Math.abs(fin.profit))}.`);
  if (li.length === 0) alerts.push(`Chưa có dữ liệu bán hàng tháng ${month} (kiểm tra cron tg-boc-don / bot nhóm Đơn Hàng).`);
  if (!finIsCurrent && fin) alerts.push(`ℹP&L mới nhất là ${fin.label} — tháng ${month} chưa chốt số tài chính.`);

  const daysSince = (d: any) => d ? Math.floor((new Date(todayStr + "T23:59:59").getTime() - new Date(d).getTime()) / 864e5) : 999;
  const [tuoiSo, { data: chatLatest }, { data: jtFresh }] = await Promise.all([
    tuoiNguonDon(sb),
    sb.from("salework_chat_analysis").select("analyzed_at").order("analyzed_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("jt_summary").select("updated_at").eq("id", 1).maybeSingle(),
  ]);
  const jtDays = daysSince(jtFresh?.updated_at);
  const chatDays = daysSince(chatLatest?.analyzed_at);

  if (tuoiSo.teleTre === null || tuoiSo.teleTre > 2) alerts.push(`Sổ đơn Telegram cũ ${tuoiSo.teleTre ?? "?"} ngày — kiểm cron tg-boc-don.`);
  if (jtDays > 2) alerts.push(`J&T chưa đồng bộ ${jtDays} ngày — kiểm tra cron J&T.`);
  if (chatDays > 3) alerts.push(`Chấm chat chưa chạy ${chatDays} ngày.`);

  const metrics = {
    month, daThangPct: expectedPct,
    sale: { doanhSo: saleRev, mucTieu: saleTarget, datKPIpct: salePct, soDon: saleOrders, soKhach: saleCustomers },
    taiChinh: fin ? { ky: fin.label, doanhThu: fin.revenue, chiPhi: fin.total_cost, loiNhuan: fin.profit, bienLNpct: fin.revenue ? Math.round(fin.profit / fin.revenue * 100) : 0 } : null,
    kho: { spSapHet: lowStock, spHetHang: outStock, donHoanThang: jtReturns || 0 },
    nhanSu: { soNhanVien: headcount, quyLuong: payrollCost },
  };
  const cachedAnalysis = await getConfigValue(`bgd_ai_${month}`);
  const { locale, t } = getT();
  const money = (n: number) => (locale === "vi" ? fmtVND(n) : fmtMoneyL(locale, n));

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pt-2 border-t border-gray-100">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">{t("Tổng quan phòng ban (BGĐ)")}</h2>
          <p className="text-sm text-gray-500 mt-1">{t("Chỉ số chính các phòng — cập nhật")} {todayStr}. {t("Đã qua")} {expectedPct}{t("% tháng")} {month}.</p>
        </div>
        <form className="flex gap-2 items-center">
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <div className="text-sm font-semibold text-amber-900">{t("Cảnh báo cần chú ý")}</div>
          {alerts.map((a, i) => <div key={i} className="text-sm text-amber-800">{a}</div>)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={t("Kinh doanh (Sale)")} href="/bao-cao-sale" tone={salePct >= expectedPct ? "emerald" : "red"}>
          <Big label={t("Doanh số tháng")} value={money(saleRev)} />
          <Row3 a={`${salePct}% KPI`} b={`${saleOrders} ${t("đơn")}`} c={`${saleCustomers} ${t("khách")}`} />
          <Bar pct={salePct} expected={expectedPct} />
          <div className="text-xs text-gray-400 mt-1">{t("Mục tiêu tháng:")} {money(saleTarget)} · {t("nhịp")} {expectedPct}%</div>
        </Card>

        <Card title={t("Tài chính (P&L)")} href="/tai-chinh" tone={fin ? (fin.profit >= 0 ? "emerald" : "red") : "slate"}>
          {fin ? (<>
            <Big label={`${t("Lợi nhuận")} ${mlabel(locale, t(fin.label))}`} value={(fin.profit >= 0 ? "+" : "") + money(fin.profit)} />
            <Row3 a={`${t("DT")} ${money(fin.revenue)}`} b={`${t("CP")} ${money(fin.total_cost)}`} c={`${t("biên")} ${fin.revenue ? Math.round(fin.profit / fin.revenue * 100) : 0}%`} />
          </>) : <div className="text-sm text-gray-400">{t("Chưa có dữ liệu P&L.")}</div>}
        </Card>

        <Card title={t("Nhân sự")} href="/nhan-su" tone="slate">
          <Big label={t("Nhân sự đang làm")} value={`${headcount} ${t("người")}`} />
          <Row3 a={`${t("Quỹ lương")} ${money(payrollCost)}`} b="" c="" />
        </Card>

        <Card title={t("Marketing (đa kênh)")} href="https://mkt-studio.example.com" tone="slate">
          <Big label={t("Đo lường fanpage")} value={t("9 kênh · 240K+ follower")} />
          <div className="text-xs text-gray-500 mt-1">{t("FB/YouTube/TikTok tự sync hằng ngày. Bấm để xem chi tiết →")}</div>
        </Card>
      </div>

      <BgdAiPanel month={month} metrics={metrics} cached={cachedAnalysis} />
    </div>
  );
}

function Card({ title, href, tone, children }: { title: string; href: string; tone: string; children: React.ReactNode }) {
  const border: Record<string, string> = { emerald: "border-emerald-200", red: "border-red-200", slate: "border-gray-200" };
  return (
    <a href={href} className={`block bg-white border rounded-xl p-5 hover:shadow-md transition ${border[tone] || "border-gray-200"}`}>
      <div className="text-sm font-semibold mb-2">{title}</div>
      {children}
    </a>
  );
}
function Big({ label, value }: { label: string; value: string }) {
  return <div className="mb-1"><div className="text-xs text-gray-500">{label}</div><div className="sensitive text-2xl font-bold">{value}</div></div>;
}
function Row3({ a, b, c }: { a: string; b: string; c: string }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">{[a, b, c].filter(Boolean).map((x, i) => <span key={i}>{x}</span>)}</div>;
}
function Bar({ pct, expected }: { pct: number; expected: number }) {
  const { t: t } = getT();
  return (
    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden relative">
      <div className={`h-full ${pct >= expected ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      <div className="absolute top-0 bottom-0 w-0.5 bg-gray-500" style={{ left: `${Math.min(expected, 100)}%` }} title={t("nhịp")} />
    </div>
  );
}
