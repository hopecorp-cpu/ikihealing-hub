"use client";
import { useMemo, useState } from "react";
import { fmtVND } from "@/lib/payroll";
import { decomposeTarget, planCombos, DEFAULT_COMBOS, type ComboInput } from "@/lib/kpi-planner";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useLang } from "@/components/lang-provider";

const fmtTr = (n: number) => (n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tr";
const r0 = (n: number) => Math.round(n).toLocaleString("vi-VN");
const r1 = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });

type SaleStat = { id: string; name: string; position: string; revenueNet: number; revenueGross: number; weight: number };

export function KpiPlanner({
  month, monthTarget, monthActual, annualTarget, defaultAov, saleStats, canEdit,
}: {
  month: string; monthTarget: number; monthActual: number; annualTarget: number; defaultAov: number; saleStats: SaleStat[]; canEdit: boolean;
}) {
  const { t } = useLang();
  const [targetTr, setTargetTr] = useState(String(Math.round(monthTarget / 1_000_000)));
  const [workDays, setWorkDays] = useState("26");
  const [aov, setAov] = useState(String(defaultAov));
  const [ordersPerCust, setOrdersPerCust] = useState("1");
  const [closeRatePct, setCloseRatePct] = useState("30");
  const revenueSaleCount = saleStats.filter(s => s.weight > 0).length || saleStats.length || 1;
  const [nSales, setNSales] = useState(String(revenueSaleCount));
  const [includeVat, setIncludeVat] = useState(true);
  const [weights, setWeights] = useState<Record<string, string>>(
    () => Object.fromEntries(saleStats.map(s => [s.id, String(s.weight)]))
  );
  const [combos, setCombos] = useState<ComboInput[]>(DEFAULT_COMBOS);
  const sumWeight = saleStats.reduce((sum, s) => sum + (parseFloat(weights[s.id]) || 0), 0);

  const targetNet = (parseFloat(targetTr.replace(",", ".")) || 0) * 1_000_000;

  const VAT = 0.08;
  const target = includeVat ? targetNet * (1 + VAT) : targetNet;
  const nS = Math.max(1, +nSales || 1);

  const cascade = useMemo(() => decomposeTarget({
    monthTarget: target,
    workDaysPerMonth: +workDays || 26,
    weeksPerMonth: 4.33,
    aov: +aov || 0,
    ordersPerCustomer: +ordersPerCust || 1,
    closeRate: (+closeRatePct || 100) / 100,
  }), [target, workDays, aov, ordersPerCust, closeRatePct]);

  const perPerson = useMemo(() => decomposeTarget({
    monthTarget: target / nS,
    workDaysPerMonth: +workDays || 26,
    weeksPerMonth: 4.33,
    aov: +aov || 0,
    ordersPerCustomer: +ordersPerCust || 1,
    closeRate: (+closeRatePct || 100) / 100,
  }), [target, nS, workDays, aov, ordersPerCust, closeRatePct]);

  const plan = useMemo(() => planCombos(target, combos), [target, combos]);

  const setCombo = (i: number, patch: Partial<ComboInput>) =>
    setCombos(cs => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  const addCombo = () => setCombos(cs => [...cs, { name: t("Combo mới"), listPrice: 1_000_000, marginPct: 60, discountPct: 10, sharePct: 0 }]);
  const delCombo = (i: number) => setCombos(cs => cs.filter((_, idx) => idx !== i));

  const actualForPace = includeVat ? monthActual : monthActual / 1.08;
  const pacePct = target > 0 ? actualForPace / target * 100 : 0;
  const perPersonTarget = target / nS;
  const curQuarter = "Q" + Math.ceil(+month.slice(5) / 3);

  return (
    <fieldset disabled={!canEdit} className="space-y-6 min-w-0 m-0 p-0 border-0">
      {!canEdit && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
          <b>{t("Chế độ chỉ xem")}</b> — {t("đây là mục tiêu doanh thu chính thức do Ban Giám đốc thiết lập. Bạn xem để nắm")}
          {t("chỉ tiêu của")} <b>{t("team")}</b> {t("và")} <b>{t("từng sale")}</b> {t("theo quý / tháng / tuần / ngày, và cần đạt bao nhiêu doanh thu.")}
        </div>
      )}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h2 className="font-semibold mb-3">{t("Thông số kế hoạch — tháng")} {month}</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          <Field label={t("Target tháng — NET (triệu)")}><input value={targetTr} onChange={e => setTargetTr(e.target.value.replace(/[^\d.,]/g, ""))} className="inp" /></Field>
          <Field label={t("Số sale chia mục tiêu")}><input value={nSales} onChange={e => setNSales(e.target.value.replace(/[^\d]/g, ""))} className="inp" /></Field>
          <Field label={t("Số ngày bán/tháng")}><input value={workDays} onChange={e => setWorkDays(e.target.value.replace(/[^\d]/g, ""))} className="inp" /></Field>
          <Field label={t("AOV — giá trị/đơn")}><input value={aov} onChange={e => setAov(e.target.value.replace(/[^\d]/g, ""))} className="inp" /></Field>
          <Field label={t("Số đơn / 1 khách")}><input value={ordersPerCust} onChange={e => setOrdersPerCust(e.target.value.replace(/[^\d.,]/g, ""))} className="inp" /></Field>
          <Field label={t("Tỉ lệ chốt (%)")}><input value={closeRatePct} onChange={e => setCloseRatePct(e.target.value.replace(/[^\d]/g, ""))} className="inp" /></Field>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={includeVat} onChange={e => setIncludeVat(e.target.checked)} className="w-4 h-4" />
          <span className="font-medium text-emerald-700">{t("Cộng 8% VAT vào target sale (doanh thu phải THU từ khách = net + VAT thu hộ)")}</span>
        </label>
        <div className="text-[11px] text-gray-500 mt-1.5">
          {includeVat
            ? <>{t("Target NET")} <b>{fmtTr(targetNet)}</b> → {t("sale phải")} <b>{t("thu từ khách")} {fmtTr(target)}</b> {t("(gồm 8% VAT nộp lại). Mọi số đơn/khách bên dưới tính trên số khách trả này.")}</>
            : <>{t("Đang tính trên target NET")} <b>{fmtTr(targetNet)}</b> {t("(chưa cộng VAT).")}</>}
          {" "}{t("AOV gợi ý")} {fmtVND(defaultAov)}. {t("Có")} {saleStats.length} {t("sale active.")}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t("Quý (×3 tháng)")} value={fmtTr(cascade.quarter)} sub={t("mục tiêu quý")} tone="slate" />
        <Stat label={t("Tháng")} value={fmtTr(cascade.month)} sub={`${t("còn")} ${fmtTr(Math.max(0, target - actualForPace))} ${t("để đạt")}`} tone="emerald" />
        <Stat label={t("Tuần")} value={fmtTr(cascade.week)} sub={t("≈ 4.33 tuần/tháng")} tone="blue" />
        <Stat label={`${t("Ngày /")} ${nS} ${t("sale")}`} value={fmtTr(perPerson.day)} sub={`${t("mỗi sale/ngày · tổng")} ${fmtTr(cascade.day)}`} tone="amber" />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h2 className="font-semibold mb-1">{t("Sale cần đạt gì để về đích")}</h2>
        <p className="text-xs text-gray-500 mb-4">{t("Quy đổi target → số đơn, số khách, số lead cần — theo nhịp tháng/tuần/ngày. Cột")} <b>{t("/ 1 sale")}</b> = {t("chia đều cho")} {nS} {t("sale")}.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-2">{t("Chỉ tiêu")}</th>
                <th className="text-right p-2">{t("/ Tháng")}</th>
                <th className="text-right p-2">{t("/ Tuần")}</th>
                <th className="text-right p-2">{t("/ Ngày")}</th>
                <th className="text-right p-2 bg-indigo-50">{t("/ 1 sale · ngày")}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <Row k={t("Doanh thu")} m={fmtTr(cascade.month)} w={fmtTr(cascade.week)} d={fmtTr(cascade.day)} p={fmtTr(perPerson.day)} bold />
              <Row k={t("Số đơn cần chốt")} m={r0(cascade.ordersMonth)} w={r0(cascade.ordersWeek)} d={r1(cascade.ordersDay)} p={r1(perPerson.ordersDay)} />
              <Row k={t("Số khách cần")} m={r0(cascade.customersMonth)} w={r0(cascade.customersWeek)} d={r1(cascade.customersDay)} p={r1(perPerson.customersDay)} />
              <Row k={`${t("Lead cần (chốt")} ${closeRatePct}%)`} m={r0(cascade.leadsMonth)} w={r0(cascade.leadsWeek)} d={r1(cascade.leadsDay)} p={r1(perPerson.leadsDay)} />
              <Row k={t("AOV mục tiêu")} m={fmtVND(+aov || 0)} w="—" d="—" p="—" />
            </tbody>
          </table>
        </div>
        {monthActual > 0 && (
          <div className="mt-3 text-xs bg-blue-50 border border-blue-200 rounded-lg p-3">
            {t("Sơn độ thực tế tháng này:")} <b>{fmtTr(actualForPace)}</b> / {fmtTr(target)} = <b>{pacePct.toFixed(0)}%</b>.
            {pacePct < 100 && <> {t("Cần thêm")} <b>{fmtTr(Math.max(0, target - actualForPace))}</b> → ≈ <b>{r0(Math.max(0, (target - actualForPace) / (+aov || 1)))}</b> {t("đơn nữa.")}</>}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h2 className="font-semibold mb-1">{t("Giao KPI từng sale — tháng")} {month}</h2>
        <p className="text-xs text-gray-500 mb-3">
          {t("Mục tiêu mỗi sale =")} {includeVat ? t("target THU (gồm VAT)") : t("target NET")} <b>{fmtTr(target)}</b> {t("× (trọng số ÷ tổng trọng số")} {sumWeight.toFixed(1)}).
          <b> {t("Trọng số sửa được")}</b> — {t("Leader cao nhất, Trực page = 0 (hỗ trợ, không giao target DT).")}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-2">{t("Sale")}</th>
                <th className="text-center p-2 bg-indigo-50">{t("Trọng số")}</th>
                <th className="text-right p-2">{t("Mục tiêu")}</th>
                <th className="text-right p-2">{t("Thực tế")}</th>
                <th className="text-right p-2">{t("% đạt")}</th>
                <th className="text-right p-2">{t("Còn thiếu")}</th>
                <th className="text-right p-2">{t("Đơn cần thêm")}</th>
                <th className="text-center p-2">{t("Trạng thái")}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {saleStats.map(s => {
                const w = parseFloat(weights[s.id]) || 0;
                const isSupport = w <= 0;
                const tgt = sumWeight > 0 ? target * w / sumWeight : 0;
                const actual = includeVat ? s.revenueGross : s.revenueNet;
                const pct = tgt > 0 ? actual / tgt * 100 : 0;
                const gap = Math.max(0, tgt - actual);
                const ordersLeft = +aov > 0 ? Math.ceil(gap / +aov) : 0;
                let tag = t("Cần đẩy mạnh"), color = "#DC2626";
                if (isSupport) { tag = t("Trực page / hỗ trợ"); color = "#6B7280"; }
                else if (pct >= 90) { tag = t("Đang tốt"); color = "#16A34A"; }
                else if (pct >= 60) { tag = t("Cần cố gắng"); color = "#F59E0B"; }
                return (
                  <tr key={s.id} className={`border-t border-gray-100 ${isSupport ? "bg-gray-50/60" : ""}`}>
                    <td className="p-2"><div className="font-medium whitespace-nowrap">{s.name}</div><div className="text-[10px] text-gray-500 whitespace-nowrap">{s.position}</div></td>
                    <td className="p-2 text-center bg-indigo-50/40">
                      <input value={weights[s.id] ?? "0"} onChange={e => setWeights(p => ({ ...p, [s.id]: e.target.value.replace(/[^\d.,]/g, "") }))}
                        className="w-14 px-1.5 py-1 border border-gray-200 rounded text-center tabular-nums" />
                    </td>
                    <td className="p-2 text-right font-semibold">{isSupport ? "—" : fmtTr(tgt)}</td>
                    <td className="p-2 text-right font-medium">{fmtTr(actual)}</td>
                    <td className="p-2 text-right font-semibold" style={{ color }}>{isSupport ? "—" : pct.toFixed(0) + "%"}</td>
                    <td className="p-2 text-right text-gray-600">{isSupport ? "—" : (gap > 0 ? fmtTr(gap) : "—")}</td>
                    <td className="p-2 text-right">{isSupport ? "—" : (ordersLeft > 0 ? `+${ordersLeft}` : "—")}</td>
                    <td className="p-2 text-center whitespace-nowrap text-xs font-medium" style={{ color }}>{tag}</td>
                  </tr>
                );
              })}
              {saleStats.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-gray-400">{t("Chưa có sale active")}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">{t("Mặc định: Leader Sale 1.5 · Sale 1.0 · Sale thử việc 0.7 · Trực page 0. Sửa trọng số → mục tiêu tự chia lại. (Sơn hotline nhiều → có thể tăng lên 2.0.)")}</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h2 className="font-semibold mb-1">{t("Gợi ý combo & quà theo mùa vụ")} <span className="text-xs font-normal text-gray-400">{t('(gợi ý lập kế hoạch — đo hiệu quả thật ở "Phễu & Chiến dịch")')}</span></h2>
        <p className="text-xs text-gray-500 mb-3">{t("Gợi ý theo mùa vụ ACME — bám dòng SP margin cao (Đạm Mẫu, Khoá MAU, Cà phê NOVA). Ngôn ngữ tuân thủ: thực phẩm bổ sung.")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CAMPAIGNS.map(c => (
            <div key={c.q} className={`rounded-lg border p-3 ${c.q === curQuarter ? "border-emerald-300 bg-emerald-50/40" : "border-gray-200"}`}>
              <div className="text-sm font-semibold flex items-center gap-2">{c.q} <span className="text-[10px] text-gray-400">{t(c.months)}</span>{c.q === curQuarter && <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">{t("Quý này")}</span>}</div>
              <div className="text-xs text-gray-700 mt-1"><b>{t("Chủ đề:")}</b> {t(c.theme)}</div>
              <div className="text-xs text-gray-600 mt-0.5"><b>{t("Combo đẩy:")}</b> {t(c.combos)}</div>
              <div className="text-xs text-gray-500 mt-0.5"><b>{t("Quà tặng:")}</b> {t(c.discount)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">{t("Combo bán gì — tặng quà gì (KHÔNG chiết khấu)")}</h2>
          <button onClick={addCombo} className="text-xs inline-flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"><Plus className="w-3 h-3" /> {t("Thêm combo")}</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">{t("Giữ nguyên giá bán,")} <b>{t("tặng quà giá vốn thấp")}</b> {t("(vd mua 3 đạm tặng 1 trà). Cột")} "<b>{t("Giữ được vs CK 10%")}</b>" = {t("lãi giữ lại nhờ tặng quà thay vì chiết khấu 10%.")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1040px]">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase">
              <tr>
                <th className="text-left p-2">{t("Combo")}</th>
                <th className="text-right p-2">{t("Giá bán")}</th>
                <th className="text-right p-2">{t("Margin gốc %")}</th>
                <th className="text-left p-2 bg-amber-50">{t("Quà tặng")}</th>
                <th className="text-right p-2 bg-amber-50">{t("Giá vốn quà")}</th>
                <th className="text-right p-2">{t("Margin sau tặng")}</th>
                <th className="text-right p-2">{t("% đóng góp")}</th>
                <th className="text-right p-2">{t("Số combo cần")}</th>
                <th className="text-right p-2">{t("Lãi gộp")}</th>
                <th className="text-right p-2 bg-emerald-50">{t("Giữ được vs CK 10%")}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {plan.rows.map((r, i) => (
                <tr key={i} className={`border-t border-gray-100 ${r.marginWarn ? "bg-red-50/40" : ""}`}>
                  <td className="p-1.5"><input value={r.name} onChange={e => setCombo(i, { name: e.target.value })} className="inp-l w-48" /></td>
                  <td className="p-1.5"><input value={String(r.listPrice)} onChange={e => setCombo(i, { listPrice: +e.target.value.replace(/[^\d]/g, "") || 0 })} className="inp w-24" /></td>
                  <td className="p-1.5"><input value={String(r.marginPct)} onChange={e => setCombo(i, { marginPct: +e.target.value.replace(/[^\d]/g, "") || 0 })} className="inp w-14" /></td>
                  <td className="p-1.5 bg-amber-50/40"><input list="gift-suggestions" value={r.giftName} onChange={e => setCombo(i, { giftName: e.target.value })} className="inp-l w-40" /></td>
                  <td className="p-1.5 bg-amber-50/40"><input value={String(r.giftCost)} onChange={e => setCombo(i, { giftCost: +e.target.value.replace(/[^\d]/g, "") || 0 })} className="inp w-20" /></td>
                  <td className={`p-1.5 text-right font-semibold ${r.marginWarn ? "text-red-600" : "text-emerald-600"}`}>
                    {r.marginWarn && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}{r.marginAfterPct.toFixed(0)}%
                  </td>
                  <td className="p-1.5"><input value={String(r.sharePct)} onChange={e => setCombo(i, { sharePct: +e.target.value.replace(/[^\d]/g, "") || 0 })} className="inp w-14" /></td>
                  <td className="p-1.5 text-right font-semibold">{r0(r.unitsNeeded)}</td>
                  <td className="p-1.5 text-right text-emerald-700">{fmtTr(r.grossProfit)}</td>
                  <td className="p-1.5 text-right font-semibold text-emerald-700 bg-emerald-50/40">+{fmtTr(r.vsDiscount10)}</td>
                  <td className="p-1.5 text-center"><button onClick={() => delCombo(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold bg-gray-50">
                <td className="p-2">{t("TỔNG")}</td>
                <td colSpan={4} className="p-2 text-right text-xs text-gray-500">{t("Margin blend:")} <b className={plan.blendedMarginPct < 30 ? "text-red-600" : "text-emerald-600"}>{plan.blendedMarginPct.toFixed(0)}%</b> · {t("CP quà:")} {fmtTr(plan.totalGiftCost)}</td>
                <td></td>
                <td className={`p-2 text-right ${plan.totalShare !== 100 ? "text-red-600" : "text-emerald-600"}`}>{plan.totalShare}%</td>
                <td className="p-2 text-right">{r0(plan.totalUnits)}</td>
                <td className="p-2 text-right text-emerald-700">{fmtTr(plan.totalGrossProfit)}</td>
                <td className="p-2 text-right text-emerald-700 bg-emerald-50/40">+{fmtTr(plan.rows.reduce((s, r) => s + r.vsDiscount10, 0))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <datalist id="gift-suggestions">
          {GIFT_SUGGESTIONS.map(g => <option key={t(g)} value={t(g)} />)}
        </datalist>
        <div className="mt-2 text-xs bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800">
          {t("Tặng quà thay vì chiết khấu 10% giúp giữ lại")} <b>{fmtTr(plan.rows.reduce((s, r) => s + r.vsDiscount10, 0))}</b> {t("lãi/tháng — vì quà chỉ mất")} <b>{t("giá vốn")}</b>, {t("còn chiết khấu mất")} <b>{t("nguyên giá bán")}</b>.
        </div>
        {plan.totalShare !== 100 && (
          <div className="mt-2 text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {t("Tổng % đóng góp =")} {plan.totalShare}% {t("(nên = 100%). Doanh thu combo đang phủ:")} {fmtTr(plan.totalRev)} / {fmtTr(target)}.</div>
        )}
      </div>

      <style jsx>{`
        .inp{width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;text-align:right}
        .inp-l{padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;text-align:left}
      `}</style>
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-gray-500 block mb-0.5">{label}</span>{children}</label>;
}
function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  const tones: Record<string, string> = { slate: "border-slate-200", emerald: "border-emerald-300 bg-emerald-50/40", blue: "border-blue-200", amber: "border-amber-200" };
  return (
    <div className={`bg-white border rounded-xl p-4 ${tones[tone] || "border-gray-200"}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}
function Row({ k, m, w, d, p, bold }: { k: string; m: string; w: string; d: string; p: string; bold?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 ${bold ? "font-semibold" : ""}`}>
      <td className="p-2">{k}</td>
      <td className="p-2 text-right">{m}</td>
      <td className="p-2 text-right">{w}</td>
      <td className="p-2 text-right">{d}</td>
      <td className="p-2 text-right bg-indigo-50/40 font-medium">{p}</td>
    </tr>
  );
}

const GIFT_SUGGESTIONS = [
  "Lớp Sống Khoẻ 3 ngày (Zoom)",
  "Lớp dinh dưỡng qua Zoom",
  "Tư vấn dinh dưỡng 1-1",
  "Thực đơn dinh dưỡng cá nhân hoá",
  "Đồng hành 7 ngày (nhóm Zalo)",
  "Voucher tái mua đơn sau",
  "Livestream/khoá học sức khoẻ online",
  "Nhóm cộng đồng VIP + Q&A chuyên gia",
  "Cẩm nang ăn uống lành mạnh (PDF)",
  "1 Trà Mẫu A",
  "1 hộp Đạm Mẫu",
  "1 Hạt nêm rau củ",
  "1 Muối tre SAHU",
];

const CAMPAIGNS = [
  { q: "Q1", months: "T1–T3", theme: "Tết & Khởi đầu sống khoẻ đầu năm", combos: "Đạm Mẫu Combo 3 hộp · Combo khởi đầu sống khoẻ sau Tết", discount: "Lớp Sống Khoẻ 3 ngày (Zoom) + lì xì sức khoẻ (trà)" },
  { q: "Q2", months: "T4–T6", theme: "Hè sống khoẻ — chăm sóc tiêu hoá & vóc dáng", combos: "Combo Sống Khoẻ 7 ngày · Cà phê hữu cơ NOVA · Combo hỗ trợ tiêu hoá", discount: "Lớp Sống Khoẻ 3 ngày + lớp dinh dưỡng Zoom" },
  { q: "Q3", months: "T7–T9", theme: "Vu Lan – Back to school – Combo gia đình", combos: "Combo gia đình Đạm Mẫu · Combo chăm sóc sức khoẻ", discount: "Lớp dinh dưỡng Zoom cho cả nhà + 1 trà" },
  { q: "Q4", months: "T10–T12", theme: "20/10 – Cao điểm cuối năm – Tết sớm", combos: "Đạm Mẫu Combo lớn · Combo quà biếu sức khoẻ", discount: "Lớp Sống Khoẻ 3 ngày + quà biếu sức khoẻ" },
];
