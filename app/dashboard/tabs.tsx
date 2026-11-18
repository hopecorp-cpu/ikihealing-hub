"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { fmtVND } from "@/lib/payroll";
import { PRODUCT_LINE_INFO } from "@/lib/bi-targets";
import {
  TrendingUp, TrendingDown, Users, ShoppingCart, Wallet, Target, Award, Package,
  DollarSign, Percent, Activity, Clock, Zap, Crown, AlertTriangle, CheckCircle2,
  ArrowUp, ArrowDown, Gauge, Repeat, UserPlus
} from "lucide-react";
import { ExecutiveCharts, RevenueCharts, ProfitCharts, OpsCharts, CustomersCharts } from "./charts";
import { useLang } from "@/components/lang-provider";

type TabId = "executive" | "revenue" | "profit" | "ops" | "customers";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "executive", label: "Tổng quan CEO",     icon: Crown },
  { id: "revenue",   label: "Doanh thu chi tiết", icon: TrendingUp },
  { id: "profit",    label: "Lợi nhuận & P&L",    icon: Wallet },
  { id: "ops",       label: "Vận hành & Sale",    icon: Activity },
  { id: "customers", label: "Khách hàng",         icon: Users }
];

export function DashboardTabs({ currentTab, data }: { currentTab: string; data: any }) {
  const { t } = useLang();
  const router = useRouter();
  const sp = useSearchParams();
  const tabs = data?.cheBod ? TABS.filter((tab) => tab.id !== "customers") : TABS;
  const tabHien = data?.cheBod && currentTab === "customers" ? "executive" : currentTab;
  const setTab = (id: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", id);
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-1 flex gap-1 overflow-x-auto">
        {tabs.map(tab => {
          const active = tabHien === tab.id;
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
                active ? "bg-gradient-to-r from-[#0B1F14] to-[#143020] text-[#F5C518] shadow" : "text-gray-600 hover:bg-gray-100"
              }`}>
              <Icon className="w-4 h-4" /> {t(tab.label)}
            </button>
          );
        })}
      </div>

      {tabHien === "executive" && <ExecutiveTab d={data} />}
      {tabHien === "revenue" && <RevenueTab d={data} />}
      {tabHien === "profit" && <ProfitTab d={data} />}
      {tabHien === "ops" && <OpsTab d={data} />}
      {tabHien === "customers" && <CustomersTab d={data} />}
    </>
  );
}

function ExecutiveTab({ d }: any) {
  const { t } = useLang();
  const pace = d.revenuePace;
  const paceColor =
    pace.status === "ahead" ? "#10B981" :
    pace.status === "on_track" ? "#3B82F6" :
    pace.status === "behind" ? "#F59E0B" : "#EF4444";
  const paceLabel =
    pace.status === "ahead" ? t("VƯỢT TARGET") :
    pace.status === "on_track" ? t("✓ ĐÚNG TIẾN ĐỘ") :
    pace.status === "behind" ? t("CHẬM") : t("RỦI RO");

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#0B1F14] to-[#143020] rounded-2xl p-6 text-white">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div className="flex-1 min-w-[280px]">
            <div className="text-xs uppercase tracking-widest text-[#F5C518] mb-1">{t("TARGET KỲ NÀY")}</div>
            <div className="text-5xl font-bold tabular-nums mb-1">
              {fmtVND(d.totalFinalRevenue)}
              <span className="text-2xl text-gray-400"> / {fmtVND(d.targets.monthlyRevenueTarget)}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-sm font-bold px-3 py-1 rounded-full`} style={{ background: paceColor + "22", color: paceColor }}>
                {paceLabel}
              </span>
              <span className="text-sm text-gray-300">
                {t("Đạt")} <b className="text-white">{pace.pacePercent.toFixed(1)}%</b> · {t("Dự báo cuối kỳ")} <b style={{ color: paceColor }}>{pace.projectedPercent.toFixed(1)}%</b>
              </span>
            </div>

            <div className="mt-3 h-3 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${Math.min(100, pace.pacePercent)}%`, background: paceColor }} />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="bg-white/5 rounded p-2">
                <div className="text-gray-400">{t("Tốc độ TB/ngày")}</div>
                <div className="font-bold text-base">{fmtVND(pace.pacePerDay)}</div>
              </div>
              <div className="bg-white/5 rounded p-2">
                <div className="text-gray-400">{t("Cần đạt/ngày")}</div>
                <div className={`font-bold text-base ${pace.dailyRateNeeded > pace.pacePerDay ? "text-orange-400" : "text-emerald-400"}`}>
                  {fmtVND(pace.dailyRateNeeded)}
                </div>
              </div>
              <div className="bg-white/5 rounded p-2">
                <div className="text-gray-400">{t("Còn thiếu")}</div>
                <div className="font-bold text-base">{fmtVND(Math.max(0, d.targets.monthlyRevenueTarget - d.totalFinalRevenue))}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 min-w-[280px]">
            <NorthStar label={t("DT KHOÁ HỌC")} value={fmtVND(d.courseRevenue)} target={fmtVND(d.targets.monthlyCourseTarget)} pct={d.coursePace.pacePercent} icon="" />
            <NorthStar label={t("MARGIN %")} value={d.marginPct.toFixed(1) + "%"} target={d.targets.marginMin + "%"} pct={d.marginPct} icon="" goodIfHigh />
            {!d.cheBod && <NorthStar label={t("LƯƠNG/DT")} value={d.payrollPct.toFixed(1) + "%"} target={`<${d.targets.payrollToRevenueMax}%`} pct={d.targets.payrollToRevenueMax - d.payrollPct + 50} icon="" goodIfHigh />}
            <NorthStar label={t("KH MỚI")} value={String(d.newCustomers)} target={String(d.returningCustomers) + " " + t("quay lại")} pct={d.customerCount > 0 ? (d.newCustomers / d.customerCount) * 100 : 0} icon="" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <ComparisonCard
          label={t("Doanh thu")}
          current={d.totalFinalRevenue}
          prev={d.prevTotal}
          prevLabel={t("Kỳ trước")}
          icon={DollarSign} color="#10B981"
        />
        <ComparisonCard
          label={t("Số đơn")}
          current={d.orderCount}
          prev={d.prevOrderCount}
          prevLabel={t("Kỳ trước")}
          icon={ShoppingCart} color="#3B82F6"
          formatter={(n: number) => String(n)}
        />
        <ComparisonCard
          label={t("DT vs cùng kỳ năm trước")}
          current={d.totalFinalRevenue}
          prev={d.prevYearTotal}
          prevLabel={t("Cùng kỳ năm trước")}
          icon={TrendingUp} color="#8B5CF6"
        />
        <ComparisonCard
          label={t("Group Bonus Pool (1%)")}
          current={d.totalFinalRevenue}
          prev={d.targets.groupBonusTrigger}
          prevLabel={`${t("Trigger")} ${fmtVND(d.targets.groupBonusTrigger)}`}
          icon={Zap}
          color={d.totalFinalRevenue >= d.targets.groupBonusTrigger ? "#10B981" : "#F59E0B"}
          customSub={d.totalFinalRevenue >= d.targets.groupBonusTrigger
            ? `${t("ACTIVE — Pool")} ${fmtVND(d.totalFinalRevenue * 0.01)}`
            : `${t("Cần thêm")} ${fmtVND(d.targets.groupBonusTrigger - d.totalFinalRevenue)}`}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-brand-600" /> {t("Doanh thu theo Dòng sản phẩm")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {(d.productLines as any[]).map((pl) => {
  const { t: t } = useLang();
            const pct = d.totalFinalRevenue > 0 ? (pl.revenue / (d.totalFinalRevenue + d.courseRevenue)) * 100 : 0;
            return (
              <div key={pl.line} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{pl.info.icon}</span>
                  <div className="font-semibold text-sm">{t(pl.info.label)}</div>
                </div>
                <div className="text-xl font-bold tabular-nums" style={{ color: pl.info.color }}>{fmtVND(pl.revenue)}</div>
                <div className="text-xs text-gray-500 mt-1">{pct.toFixed(1)}% {t("tổng DT")} · {pl.qty} {t("SP bán")}</div>
                <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full" style={{ width: `${pct}%`, background: pl.info.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ExecutiveCharts dailySeries={d.dailySeries} channels={d.channels} target={d.targets.monthlyRevenueTarget} daysElapsed={d.dailySeries.length} totalDays={d.dailySeries.length} />

      <ActionAlerts d={d} />
    </div>
  );
}

function RevenueTab({ d }: any) {
  const { t } = useLang();
  return (
    <div className="space-y-4">
      <BiTableRow headers={[t("Số Khách hàng"),t("Mã Sản Phẩm"),"Total Final Revenue","Total Gross Revenue","Total Discount","Total Net Revenue","Total Shipping Cost"]}
        values={[d.customerCount, d.productCount, d.totalFinalRevenue, d.totalGrossRevenue, d.totalDiscount, d.totalNetRevenue, d.totalShipping]}
        types={["num","num","vnd","vnd","vnd","vnd","vnd"]}
        colors={["#3B82F6","#8B5CF6","#10B981","#0EA5E9","#F59E0B","#10B981","#EF4444"]}
        bgClass="bg-gray-50"
      />
      <BiTableRow headers={[t("Giá TB/Unit"),t("TB Operation Revenue"),t("TB Gross Revenue"),t("TB Discount"),t("TB Net Revenue"),t("TB Shipping Cost")]}
        values={[
          d.orderCount > 0 ? d.totalGrossRevenue / d.totalQuantity : 0,
          d.orderCount > 0 ? d.totalFinalRevenue / d.orderCount : 0,
          d.orderCount > 0 ? d.totalGrossRevenue / d.orderCount : 0,
          d.orderCount > 0 ? d.totalDiscount / d.orderCount : 0,
          d.orderCount > 0 ? d.totalNetRevenue / d.orderCount : 0,
          d.orderCount > 0 ? d.totalShipping / d.orderCount : 0
        ]}
        types={["vnd","vnd","vnd","vnd","vnd","vnd"]}
        colors={["#8B5CF6","#10B981","#0EA5E9","#F59E0B","#10B981","#EF4444"]}
        bgClass="bg-blue-50"
      />
      <BiTableRow headers={[t("Số đơn hàng"),t("S.lượng TB/Đơn"),t("Tổng SP đã bán"),"Discount %",t("Margin ước tính")]}
        values={[
          d.orderCount,
          d.orderCount > 0 ? (d.totalQuantity / d.orderCount).toFixed(2) : "0",
          d.totalQuantity,
          d.totalGrossRevenue > 0 ? ((d.totalDiscount / d.totalGrossRevenue) * 100).toFixed(1) + "%" : "0%",
          d.marginPct.toFixed(1) + "%"
        ]}
        types={["num","raw","num","raw","raw"]}
        colors={["#0EA5E9","#8B5CF6","#10B981","#F59E0B","#10B981"]}
        bgClass="bg-amber-50"
      />
      <RevenueCharts d={d} />
    </div>
  );
}

function ProfitTab({ d }: any) {
  const { t } = useLang();
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-600" /> P&L Waterfall</h3>
        <div className="space-y-2">
          <PLRow label="(+) Gross Revenue" value={d.totalGrossRevenue} pct={100} color="#10B981" />
          <PLRow label={t("(−) Chiết khấu")} value={-d.totalDiscount} pct={d.totalGrossRevenue > 0 ? -(d.totalDiscount / d.totalGrossRevenue) * 100 : 0} color="#F59E0B" />
          <PLRow label="(=) Net Revenue" value={d.totalNetRevenue} pct={d.totalGrossRevenue > 0 ? (d.totalNetRevenue / d.totalGrossRevenue) * 100 : 0} color="#3B82F6" bold />
          <PLRow label="(−) Shipping" value={-d.totalShipping} pct={d.totalGrossRevenue > 0 ? -(d.totalShipping / d.totalGrossRevenue) * 100 : 0} color="#EF4444" />
          <PLRow label={t("(−) COGS ước tính (50%)")} value={-d.estimatedCOGS} pct={-50} color="#9CA3AF" italic />
          <PLRow label="(=) Gross Profit" value={d.grossProfit} pct={d.marginPct} color={d.marginPct >= 30 ? "#10B981" : "#EF4444"} bold large />
          {!d.cheBod && <PLRow label={t("(−) Quỹ lương")} value={-d.payrollCost} pct={-d.payrollPct} color="#EF4444" />}
          {!d.cheBod && <PLRow label={t("(=) Net Profit ước tính")} value={d.grossProfit - d.payrollCost} pct={d.totalGrossRevenue > 0 ? ((d.grossProfit - d.payrollCost) / d.totalGrossRevenue) * 100 : 0} color={(d.grossProfit - d.payrollCost) > 0 ? "#10B981" : "#EF4444"} bold large />}
        </div>
      </div>

      <ProfitCharts d={d} />
    </div>
  );
}

function OpsTab({ d }: any) {
  const { t } = useLang();
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Sale Leaderboard — Target Tracking</h3>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left py-2">Rank</th>
              <th className="text-left py-2">Sale</th>
              <th className="text-right py-2">{t("Đơn")}</th>
              <th className="text-right py-2">{t("Doanh thu")}</th>
              <th className="text-left py-2 pl-3 w-[35%]">% Target</th>
              <th className="text-center py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(d.topSales as any[]).map((s, i) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="py-2">
                  <span className={`inline-flex w-7 h-7 rounded-full text-xs font-bold items-center justify-center ${
                    i === 0 ? "bg-yellow-100 text-yellow-700" :
                    i === 1 ? "bg-gray-100 text-gray-700" :
                    i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-500"
                  }`}>{i === 0 ? "" : i === 1 ? "" : i === 2 ? "" : i + 1}</span>
                </td>
                <td className="py-2 font-semibold">{s.name}</td>
                <td className="py-2 text-right tabular-nums">{s.orders}</td>
                <td className="py-2 text-right tabular-nums font-bold">{fmtVND(s.revenue)}</td>
                <td className="py-2 pl-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full transition-all"
                        style={{ width: `${Math.min(150, s.pct)}%`, background: s.pct >= 100 ? "#10B981" : s.pct >= 70 ? "#F59E0B" : "#EF4444" }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-12 text-right">{s.pct.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="py-2 text-center text-lg">{s.status}</td>
              </tr>
            ))}
            {d.topSales.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">{t("Chưa có data sale")}</td></tr>
            )}
          </tbody>
        </table>
        <div className="mt-3 text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-2">
          {t("NV target = 100M · Leader target = 150M · ≥100% · 70-99% · dưới 70%")}
        </div>
      </div>

      <OpsCharts d={d} />
    </div>
  );
}

function CustomersTab({ d }: any) {
  const { t } = useLang();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <MetricCard icon={UserPlus} label={t("KH MỚI")} value={String(d.newCustomers)} color="#10B981" sub={t("lần đầu mua")} />
        <MetricCard icon={Repeat} label={t("KH QUAY LẠI")} value={String(d.returningCustomers)} color="#3B82F6" sub={t("đã mua trước")} />
        <MetricCard icon={Users} label={t("TỔNG KH KỲ")} value={String(d.customerCount)} color="#8B5CF6" sub={`new ratio: ${d.customerCount > 0 ? ((d.newCustomers / d.customerCount) * 100).toFixed(0) : 0}%`} />
        <MetricCard icon={DollarSign} label={t("AOV (TB/đơn)")} value={d.orderCount > 0 ? fmtVND(d.totalFinalRevenue / d.orderCount) : "—"} color="#F59E0B" sub={`${d.customerCount > 0 ? (d.orderCount / d.customerCount).toFixed(2) : 0} ${t("đơn/KH")}`} />
      </div>

      <CustomersCharts d={d} />
    </div>
  );
}

function NorthStar({ label, value, target, pct, icon, goodIfHigh }: any) {
  const { t } = useLang();
  const isGood = goodIfHigh ? pct >= 100 : pct >= 70;
  return (
    <div className="bg-white/10 rounded-lg p-3 border border-white/10">
      <div className="text-[10px] uppercase tracking-wide text-gray-300 flex items-center gap-1">
        <span>{icon}</span> {label}
      </div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
      <div className={`text-[10px] mt-0.5 ${isGood ? "text-emerald-300" : "text-orange-300"}`}>
        {t("Target")}: {target}
      </div>
    </div>
  );
}

function ComparisonCard({ label, current, prev, prevLabel, icon: Icon, color, formatter, customSub }: any) {
  const { t } = useLang();
  const f = formatter || fmtVND;
  const noPrev = !prev;
  const deltaVal = prev === 0 ? 0 : ((current - prev) / prev) * 100;
  const positive = deltaVal >= 0;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex justify-between items-center mb-1">
        <div className="text-xs uppercase font-semibold text-gray-500">{label}</div>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-xl font-bold leading-tight" style={{ color }}>{f(current)}</div>
      {customSub ? (
        <div className="text-xs text-gray-500 mt-1">{customSub}</div>
      ) : (
        noPrev ? (
        <div className="text-xs text-gray-400 mt-1">{t("— chưa có dữ liệu")} {prevLabel.toLowerCase()}</div>
        ) : (
        <div className="flex items-center gap-1 text-xs mt-1">
          <span className={`font-bold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
            {positive ? "▲" : "▼"} {Math.abs(deltaVal).toFixed(1)}%
          </span>
          <span className="text-gray-500">{t("vs")} {prevLabel} ({f(prev)})</span>
        </div>
        )
      )}
    </div>
  );
}

function BiTableRow({ headers, values, types, colors, bgClass }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={bgClass}>
          <tr>
            {headers.map((h: string, i: number) => (
              <th key={i} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide border-r border-gray-200 last:border-r-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {values.map((v: any, i: number) => {
              const type = types[i];
              let display: string;
              if (type === "vnd") {
                const n = +v;
                if (n >= 1_000_000_000) display = (n / 1_000_000_000).toFixed(2) + "B";
                else if (n >= 1_000_000) display = (n / 1_000_000).toFixed(2) + "M";
                else if (n >= 1_000) display = (n / 1_000).toFixed(2) + "K";
                else display = n.toFixed(0);
              } else if (type === "num") display = new Intl.NumberFormat("vi-VN").format(+v);
              else display = String(v);
              return (
                <td key={i} className="px-3 py-3 border-r border-gray-100 last:border-r-0">
                  <div className="text-xl font-bold tabular-nums" style={{ color: colors[i] }}>{display}</div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PLRow({ label, value, pct, color, bold, italic, large }: any) {
  return (
    <div className={`flex items-center gap-3 py-2 ${bold ? "border-t-2 border-gray-200 pt-3" : ""}`}>
      <div className={`flex-1 ${italic ? "italic text-gray-500" : ""} ${large ? "text-base" : "text-sm"} ${bold ? "font-bold" : ""}`}>{label}</div>
      <div className="w-48">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full" style={{ width: `${Math.min(100, Math.abs(pct))}%`, background: color }} />
        </div>
      </div>
      <div className="w-16 text-right text-xs text-gray-500 tabular-nums">{pct.toFixed(1)}%</div>
      <div className={`w-36 text-right tabular-nums ${large ? "text-xl" : "text-base"} ${bold ? "font-bold" : ""}`} style={{ color }}>
        {fmtVND(value)}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, sub }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs uppercase font-semibold text-gray-500">{label}</div>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function ActionAlerts({ d }: any) {
  const { t } = useLang();
  const alerts: { level: "red" | "yellow" | "green"; icon: any; text: string; action?: string; href?: string }[] = [];

  if (!d.cheBod && d.payrollPct > d.targets.payrollToRevenueMax) {
    alerts.push({ level: "red", icon: AlertTriangle, text: `${t("Lương/DT")} = ${d.payrollPct.toFixed(1)}% — ${t("vượt ngưỡng")} ${d.targets.payrollToRevenueMax}%`, action: t("Xem phân bổ lương"), href: "/bang-luong" });
  }
  if (d.marginPct < d.targets.marginMin) {
    alerts.push({ level: "red", icon: AlertTriangle, text: `Margin = ${d.marginPct.toFixed(1)}% — ${t("dưới ngưỡng")} ${d.targets.marginMin}%`, action: t("Xem chi tiết P&L") });
  }
  if (d.revenuePace.status === "at_risk") {
    alerts.push({ level: "red", icon: TrendingDown, text: `${t("Doanh thu rủi ro: cần")} ${fmtVND(d.revenuePace.dailyRateNeeded)}${t("/ngày để hit target")}`, action: t("Xem leaderboard sale"), href: "/dashboard?tab=ops" });
  }
  if (d.revenuePace.status === "behind") {
    alerts.push({ level: "yellow", icon: Clock, text: `${t("Doanh thu chậm:")} ${d.revenuePace.pacePercent.toFixed(1)}% ${t("so với mốc dự kiến")}` });
  }
  if (!d.cheBod && d.totalFinalRevenue >= d.targets.groupBonusTrigger) {
    alerts.push({ level: "green", icon: CheckCircle2, text: `${t("Group Bonus ACTIVE! Pool =")} ${fmtVND(d.totalFinalRevenue * 0.01)}` });
  }
  if (d.revenuePace.status === "ahead") {
    alerts.push({ level: "green", icon: CheckCircle2, text: `${t("Vượt tiến độ")} ${(d.revenuePace.projectedPercent - 100).toFixed(1)}% — ${t("keep going!")}` });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
      <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> {t("Action items")}</h3>
      <div className="space-y-2">
        {alerts.map((a, i) => {
  const { t: t } = useLang();
          const colors = a.level === "red" ? "bg-red-50 border-red-200 text-red-800" :
                         a.level === "yellow" ? "bg-yellow-50 border-yellow-200 text-yellow-800" :
                         "bg-emerald-50 border-emerald-200 text-emerald-800";
          const Icon = a.icon;
          return (
            <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${colors}`}>
              <div className="flex items-center gap-2 text-sm">
                <Icon className="w-4 h-4" />
                <span>{a.text}</span>
              </div>
              {a.action && a.href && (
                <a href={a.href} className="text-xs underline font-semibold">{a.action} →</a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
