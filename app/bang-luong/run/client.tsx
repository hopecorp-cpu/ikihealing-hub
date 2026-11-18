"use client";
import { useState, useTransition } from "react";
import { commitMonthlyPayroll } from "./actions";
import { fmtVND, calcPayroll, grossUpFromNet } from "@/lib/payroll";
import { Calculator, Save, Edit2, AlertCircle, CheckCircle2, RotateCcw, TrendingUp, Users, Target, Award } from "lucide-react";
import { useLang } from "@/components/lang-provider";

export function RunWizard({ month, preview }: { month: string; preview: any }) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, { bonus_override?: number; reason: string }>>({});
  const [manualEdits, setManualEdits] = useState<Record<string, { fields: Record<string, string>; reason: string }>>({});
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const setManualEdit = (userId: string, fields: Record<string, string> | undefined, reason: string) => {
    setManualEdits(prev => {
      const next = { ...prev };
      if (!fields) delete next[userId];
      else next[userId] = { fields, reason };
      return next;
    });
  };

  const committedRows: any[] = preview?.committed || [];
  const committedById = new Map(committedRows.map((r: any) => [r.user_id, r]));
  const syncFromCommitted = () => {
    if (committedRows.length === 0) { alert(t("Tháng này chưa có dòng lương đã chốt để đồng bộ")); return; }
    setManualEdits(prev => {
      const next = { ...prev };
      for (const cm of committedRows) {
        const fields: Record<string, string> = {};
        PREVIEW_COLS.forEach(col => { fields[col.k] = String(Math.round(cm[col.k] || 0)); });
        next[cm.user_id] = { fields, reason: t("Đồng bộ từ bảng lương đã chốt tháng này") };
      }
      return next;
    });
    setMsg({ text: `${t("Đã kéo")} ${committedRows.length} ${t("dòng từ bảng lương đã chốt vào tạm tính. Kiểm tra rồi bấm COMMIT để lưu.")}`, type: "ok" });
  };

  if (preview?.error) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
          <h2 className="font-bold text-red-900">{t("Lỗi khi tính:")}</h2>
          <p className="text-sm text-red-700 mt-1">{preview.error}</p>
          <p className="text-xs text-red-600 mt-3">{t("Có thể chưa run migration 014. Mở Supabase SQL Editor → paste migration 014 → Run.")}</p>
        </div>
      </div>
    );
  }

  const setOverride = (userId: string, value: number | undefined, reason: string) => {
    if (value === undefined) {
      const newO = { ...overrides };
      delete newO[userId];
      setOverrides(newO);
    } else {
      setOverrides({ ...overrides, [userId]: { bonus_override: value, reason } });
    }
  };

  const commit = () => {

    for (const [uid, ovr] of Object.entries(overrides)) {
      if (ovr.bonus_override !== undefined && (!ovr.reason || ovr.reason.length < 5)) {
        setMsg({ text: `User ${uid}: ${t("cần lý do ≥5 ký tự khi override")}`, type: "err" });
        return;
      }
    }
    for (const [uid, me] of Object.entries(manualEdits)) {
      if (!me.reason || me.reason.length < 5) {
        setMsg({ text: `User ${uid}: ${t("cần lý do ≥5 ký tự khi sửa tay")}`, type: "err" });
        return;
      }
    }

    const nEdit = Object.keys(overrides).length + Object.keys(manualEdits).length;
    if (!confirm(`${t("Commit lương tháng")} ${month}?\n\n${nEdit} ${t("dòng đã chỉnh (override + sửa tay)")}\n${t("Tổng chi:")} ${fmtVND(preview.totalPayrollCost)}\n\n${t("NV CHƯA xem được — lương lưu ở trạng thái \"chờ duyệt\". Vào Bảng lương bấm \"Duyệt\" sau khi kiểm tra thì NV mới xem được.")}`)) return;

    startTransition(async () => {
      const res = await commitMonthlyPayroll({ month, overrides, manualEdits });
      if (res.success) {
        setMsg({ text: `${t("Đã lưu")} ${res.rowsInserted} ${t("dòng (chờ duyệt). NV CHƯA xem được — vào Bảng lương bấm \"Duyệt\" để cho NV xem.")}`, type: "ok" });
      } else {
        setMsg({ text: "" + res.error, type: "err" });
      }
    });
  };

  const totalAdjusted = preview.preview.reduce((s: number, c: any) => {
    const ovr = overrides[c.user_id];
    return s + (ovr?.bonus_override !== undefined ? ovr.bonus_override : c.auto_total_bonus);
  }, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-6 h-6 text-brand-600" /> {t("Tính lương tháng")} {month}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("Auto-aggregate revenue → apply tier → preview → edit → commit")}</p>
        </div>
        <form className="flex items-center gap-2">
          <label className="text-sm">{t("Tháng:")}</label>
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Refresh")}</button>
        </form>
      </div>

      {preview.canhBaoNghi && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900">{preview.canhBaoNghi}</p>
              {(preview.phieuNghiTreo || []).length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {(preview.phieuNghiTreo as any[]).map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium">{t(p.ten)}</span>
                      <span>{p.tenLoai}</span>
                      <span>{p.tuNgay}{p.denNgay !== p.tuNgay ? ` → ${p.denNgay}` : ""} · {p.soNgay} {t("ngày")}</span>
                      {p.anhHuongTien && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-xs font-semibold">{t("lệch tiền lương")}</span>}
                      {p.tuoiNgay >= 7 && <span className="text-red-700 text-xs">treo {p.tuoiNgay} {t("ngày")}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <a href="/admin/xin-nghi" className="mt-2 inline-block text-sm font-semibold underline text-amber-900">{t("Duyệt phiếu nghỉ rồi bấm Refresh")}</a>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label={t("DT TEAM")} value={fmtVND(preview.teamTotalRevenue)} color="#10B981" icon={TrendingUp} />
        <KPI label={t("NV")} value={String(preview.preview.length)} color="#3B82F6" icon={Users} />
        <KPI label={t("BONUS AUTO")} value={fmtVND(preview.totalBonus)} color="#F59E0B" icon={Target} />
        <KPI label={t("BONUS SAU EDIT")} value={fmtVND(totalAdjusted)} color={totalAdjusted !== preview.totalBonus ? "#EF4444" : "#F59E0B"} icon={Edit2}
          sub={totalAdjusted !== preview.totalBonus ? `Δ ${fmtVND(totalAdjusted - preview.totalBonus)}` : ""} />
        <KPI label={t("TỔNG CHI")} value={fmtVND(preview.totalPayrollCost)} color="#8B5CF6" icon={Award} />
      </div>

      {preview.teamBonusTriggered && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          <div>
            <div className="font-semibold text-emerald-900">{t("Group Bonus ACTIVE!")}</div>
            <div className="text-sm text-emerald-700">{t("Team đạt")} {fmtVND(preview.teamTotalRevenue)} {t("— kích hoạt thưởng nhóm 1% pool, chia theo doanh số cá nhân.")}</div>
          </div>
        </div>
      )}

      <details className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <summary className="font-semibold cursor-pointer">{t("Bậc thưởng đang áp dụng (click để xem)")}</summary>
        <table className="w-full text-sm mt-3">
          <thead className="text-xs text-gray-500 uppercase">
            <tr><th className="text-left p-1">{t("Bậc")}</th><th className="text-right p-1">{t("Doanh thu từ")}</th><th className="text-right p-1">{t("Đến")}</th><th className="text-right p-1">{t("% Thưởng")}</th></tr>
          </thead>
          <tbody>
            {preview.rules?.map((r: any) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="p-1">{r.name} <span className="text-xs text-gray-500">[{r.scope}]</span></td>
                <td className="p-1 text-right tabular-nums">{fmtVND(r.revenue_min)}</td>
                <td className="p-1 text-right tabular-nums">{r.revenue_max ? fmtVND(r.revenue_max) : "∞"}</td>
                <td className="p-1 text-right font-bold text-brand-700">{(r.bonus_rate * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <a href="/admin/bonus-rules" className="text-xs text-brand-600 mt-2 inline-block hover:underline">{t("→ Chỉnh bậc thưởng")}</a>
      </details>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-wrap">
          <h3 className="font-semibold flex-1 min-w-[260px]">{t("Preview lương từng NV — chỉnh nhanh bonus, hoặc bấm \"Sửa hết\" để sửa Thực lĩnh & mọi cột trước khi Chốt (đều ghi audit log)")}</h3>
          {committedRows.length > 0 && (
            <button onClick={syncFromCommitted}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold whitespace-nowrap"
              title={t("Kéo đúng số lương đang có ở bảng lương đã chốt tháng này vào màn tạm tính")}>
              {t("Đồng bộ từ bảng lương đã chốt")} ({committedRows.length})
            </button>
          )}
        </div>
        <p className="px-4 pb-2 text-xs text-gray-400">{t("↔ Cuộn ngang — bố cục giống bảng lương đã chốt. Thưởng/KPI sửa nhanh inline; bấm \"Sửa hết\" để chỉnh mọi cột (gồm 4 phụ cấp).")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1900px]">
            <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase">
              <tr>
                <th className="text-left p-2 sticky left-0 bg-gray-50 z-10">{t("NV")}</th>
                <th className="text-right p-2">{t("Lương CB")}</th>
                <th className="text-right p-2">{t("Gross")}</th>
                <th className="text-center p-2">{t("NC")}</th>
                <th className="text-right p-2">{t("Lương theo NC")}</th>
                <th className="text-right p-2 bg-green-50">{t("PC ĐT")}</th>
                <th className="text-right p-2 bg-green-50">{t("PC CC")}</th>
                <th className="text-right p-2 bg-green-50">{t("PC Ăn trưa")}</th>
                <th className="text-right p-2 bg-green-50">{t("PC Xăng xe")}</th>
                <th className="text-right p-2 bg-brand-50">{t("Thưởng/KPI")}</th>
                <th className="text-right p-2">{t("Tổng TN")}</th>
                <th className="text-right p-2">{t("BH NLĐ 10.5%")}</th>
                <th className="text-right p-2">{t("Giảm trừ BT")}</th>
                <th className="text-right p-2">{t("TNTT")}</th>
                <th className="text-right p-2">{t("Thuế TNCN")}</th>
                <th className="text-right p-2">{t("Tạm ứng")}</th>
                <th className="text-right p-2 bg-emerald-50 font-bold">{t("THỰC LĨNH")}</th>
                <th className="text-right p-2 bg-orange-50">{t("BH DN 21.5%")}</th>
                <th className="text-right p-2 bg-orange-50 font-bold">{t("Tổng CP DN")}</th>
                <th className="text-right p-2">{t("% Thuế/Gr")}</th>
                <th className="text-center p-2 sticky right-0 bg-gray-50 z-10">{t("Sửa hết")}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {preview.preview.sort((a: any, b: any) => b.total_revenue_net - a.total_revenue_net).map((c: any) => (
                <PreviewRow key={c.user_id} c={c}
                  override={overrides[c.user_id]} onOverride={(v, r) => setOverride(c.user_id, v, r)}
                  manualEdit={manualEdits[c.user_id]} onManualEdit={(f, r) => setManualEdit(c.user_id, f, r)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-lg text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 flex justify-between items-center">
        <div className="text-sm">
          <span className="text-gray-500">{t("Sẽ tạo")}</span>
          <b className="ml-1">{preview.preview.length}</b>
          <span className="text-gray-500"> {t("phiếu lương ·")}</span>
          <b className="ml-1">{Object.keys(overrides).length}</b>
          <span className="text-gray-500"> {t("override ·")}</span>
          <b className="ml-1">{Object.keys(manualEdits).length}</b>
          <span className="text-gray-500"> {t("sửa tay")}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setOverrides({}); setManualEdits({}); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">
            <RotateCcw className="w-4 h-4 inline mr-1" /> {t("Reset chỉnh sửa")}
          </button>
          <button onClick={commit} disabled={pending}
            className="px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
            <Save className="w-4 h-4" /> {pending ? t("Đang commit...") : t("COMMIT LƯƠNG THÁNG") + " " + month}
          </button>
        </div>
      </div>
    </div>
  );
}

const PREVIEW_COLS: { k: string; label: string }[] = [
  { k: "gross_salary", label: "Lương Gross" },
  { k: "bonus_amount", label: "Thưởng / KPI" },
  { k: "working_days_actual", label: "NC thực tế" },
  { k: "working_days_standard", label: "NC chuẩn" },
  { k: "salary_by_workdays", label: "Lương theo NC" },
  { k: "allowance_phone", label: "PC Điện thoại" },
  { k: "allowance_attendance", label: "PC Chuyên cần" },
  { k: "allowance_lunch", label: "PC Ăn trưa" },
  { k: "allowance_fuel", label: "PC Xăng xe" },
  { k: "total_income", label: "Tổng thu nhập" },
  { k: "employee_insurance", label: "BH NLĐ (10.5%)" },
  { k: "employer_insurance", label: "BH DN (21.5%)" },
  { k: "personal_deduction", label: "Giảm trừ bản thân" },
  { k: "dependent_count", label: "Số người phụ thuộc" },
  { k: "dependent_deduction", label: "Giảm trừ NPT" },
  { k: "taxable_income", label: "Thu nhập tính thuế" },
  { k: "personal_income_tax", label: "Thuế TNCN" },
  { k: "advance_payment", label: "Tạm ứng" },
  { k: "net_salary", label: "THỰC LĨNH" },
  { k: "total_company_cost", label: "Tổng CP DN" },
];

function PreviewRow({ c, override, onOverride, manualEdit, onManualEdit }: {
  c: any; override?: any; onOverride: (v: number | undefined, r: string) => void;
  manualEdit?: { fields: Record<string, string>; reason: string }; onManualEdit: (f: Record<string, string> | undefined, r: string) => void;
}) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(c.auto_total_bonus));
  const [reason, setReason] = useState("");
  const [modal, setModal] = useState(false);

  const final = override?.bonus_override !== undefined ? override.bonus_override : c.auto_total_bonus;
  const diff = final - c.auto_total_bonus;

  const livestreamBonus = c.livestream_bonus || 0;
  const totalIncome = (c.salary_by_workdays ?? c.gross_salary) + final + livestreamBonus;
  const taxable = Math.max(0, totalIncome - c.insurance_employee - c.personal_deduction - c.dependent_deduction);
  const autoTax = c.personal_income_tax || 0;
  const autoNet = totalIncome - c.insurance_employee - autoTax;
  const autoVals: Record<string, number> = {
    base_salary: c.base_salary || 0,
    gross_salary: c.gross_salary, bonus_amount: final,
    working_days_actual: c.working_days_actual ?? 26, working_days_standard: c.working_days_standard ?? 26,
    salary_by_workdays: c.salary_by_workdays ?? c.gross_salary,
    allowance_phone: 0, allowance_attendance: 0, allowance_lunch: 0, allowance_fuel: 0,
    total_income: totalIncome,
    employee_insurance: c.insurance_employee, employer_insurance: c.insurance_employer,
    personal_deduction: c.personal_deduction, dependent_count: 0, dependent_deduction: c.dependent_deduction,
    taxable_income: taxable, personal_income_tax: autoTax, advance_payment: 0,
    net_salary: autoNet, total_company_cost: c.total_company_cost,
  };

  const me = manualEdit?.fields;
  const d = (k: string) => me?.[k] !== undefined ? (+me[k] || 0) : (autoVals[k] ?? 0);
  const gp = d("gross_salary");
  const taxPct = gp ? (d("personal_income_tax") / gp * 100) : 0;

  const liveHours = me?.hours_worked !== undefined ? (+me.hours_worked || 0) : (c.hours_worked || 0);
  const liveHourlyPay = Math.round((c.hourly_rate || 0) * liveHours) + final;
  const setHours = (h: string) => {
    const hours = Math.max(0, Number(h) || 0);
    onManualEdit({ ...(me || {}), hours_worked: String(hours) }, `${t("Part-time theo giờ:")} ${hours}h × ${(c.hourly_rate || 0).toLocaleString("vi-VN")}đ`);
  };

  const save = () => {
    if (!reason || reason.length < 5) { alert(t("Cần lý do ≥5 ký tự")); return; }
    onOverride(+val, reason);
    setEditing(false);
  };

  return (
    <>
      <tr className={`border-t border-gray-100 ${me ? "bg-purple-50" : override ? "bg-yellow-50" : ""} ${!c.is_sale ? "opacity-70" : ""}`}>
        <td className={`p-2 sticky left-0 z-10 ${me ? "bg-purple-50" : override ? "bg-yellow-50" : "bg-white"}`}>
          <div className="font-medium whitespace-nowrap">{c.full_name}</div>
          <div className="text-[10px] text-gray-500 whitespace-nowrap">{c.position}</div>
          <div className="text-[10px] whitespace-nowrap">
            {c.is_sale && <span className="text-blue-600">{t("DT net")} {fmtVND(c.total_revenue_net)}</span>}
            {livestreamBonus > 0 && <span className="text-pink-600 ml-1">{t("Live")} +{fmtVND(livestreamBonus)}</span>}
            {me && <span className="text-purple-600 ml-1">{t("sửa tay")}</span>}
          </div>
        </td>
        <td className="p-2 text-right text-gray-600">
          {c.is_hourly ? <span className="text-indigo-600 whitespace-nowrap">{fmtVND(c.hourly_rate)}/h</span> : fmtVND(d("base_salary"))}
        </td>
        <td className="p-2 text-right">{c.is_hourly ? "—" : fmtVND(d("gross_salary"))}</td>
        <td className="p-2 text-center">
          {c.is_hourly ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <input type="number" min={0} step={0.5} defaultValue={liveHours}
                onBlur={e => setHours(e.target.value)}
                className="w-16 p-1 border border-indigo-300 rounded text-right tabular-nums" title={t("Số giờ làm trong tháng")} />
              <span className="text-[10px] text-gray-500">{t("giờ")}</span>
            </span>
          ) : (
            <>{d("working_days_actual")}/{d("working_days_standard")}</>
          )}
        </td>
        <td className="p-2 text-right">{c.is_hourly ? <span className="font-medium text-indigo-700">{fmtVND(liveHourlyPay - final)}</span> : fmtVND(d("salary_by_workdays"))}</td>
        <td className="p-2 text-right text-green-700 bg-green-50/40">{d("allowance_phone") ? fmtVND(d("allowance_phone")) : "—"}</td>
        <td className="p-2 text-right text-green-700 bg-green-50/40">{d("allowance_attendance") ? fmtVND(d("allowance_attendance")) : "—"}</td>
        <td className="p-2 text-right text-green-700 bg-green-50/40">{d("allowance_lunch") ? fmtVND(d("allowance_lunch")) : "—"}</td>
        <td className="p-2 text-right text-green-700 bg-green-50/40">{d("allowance_fuel") ? fmtVND(d("allowance_fuel")) : "—"}</td>
        <td className="p-2 text-right bg-brand-50/40">
          {me ? (
            <span className="text-purple-700 font-medium">{fmtVND(d("bonus_amount"))}</span>
          ) : !editing ? (
            <button onClick={() => setEditing(true)} className="hover:underline" title={t("Sửa thưởng")}>
              <span className={diff !== 0 ? "text-orange-700 font-bold" : "text-brand-700"}>{fmtVND(final)}</span>
              {diff !== 0 ? " " : <Edit2 className="w-3 h-3 inline ml-1 text-gray-400" />}
            </button>
          ) : (
            <input type="number" value={val} onChange={e => setVal(e.target.value)} step={100000}
              className="w-28 p-1 border border-gray-300 rounded text-right tabular-nums" />
          )}
        </td>
        <td className="p-2 text-right font-medium">{fmtVND(c.is_hourly ? liveHourlyPay : d("total_income"))}</td>
        <td className="p-2 text-right text-red-600">{!c.is_hourly && d("employee_insurance") ? "-" + fmtVND(d("employee_insurance")) : "—"}</td>
        <td className="p-2 text-right text-gray-500">{fmtVND(d("personal_deduction"))}</td>
        <td className="p-2 text-right">{fmtVND(d("taxable_income"))}</td>
        <td className="p-2 text-right text-red-600">{d("personal_income_tax") ? "-" + fmtVND(d("personal_income_tax")) : "—"}</td>
        <td className="p-2 text-right text-orange-600">{d("advance_payment") ? "-" + fmtVND(d("advance_payment")) : "—"}</td>
        <td className={`p-2 text-right font-bold bg-emerald-50/50 ${me ? "text-purple-700" : "text-emerald-700"}`}>{fmtVND(c.is_hourly ? liveHourlyPay : d("net_salary"))}</td>
        <td className="p-2 text-right text-gray-500 bg-orange-50/40">{c.is_hourly ? "—" : fmtVND(d("employer_insurance"))}</td>
        <td className="p-2 text-right font-semibold bg-orange-50/40">{fmtVND(c.is_hourly ? liveHourlyPay : d("total_company_cost"))}</td>
        <td className="p-2 text-right text-gray-500">{taxPct.toFixed(1)}%</td>
        <td className={`p-2 text-center sticky right-0 z-10 ${me ? "bg-purple-50" : override ? "bg-yellow-50" : "bg-white"}`}>
          <button onClick={() => setModal(true)} className="text-purple-600 hover:underline whitespace-nowrap" title={t("Sửa Thực lĩnh & mọi cột")}>{t("Sửa hết")}</button>
        </td>
      </tr>
      {editing && (
        <tr className="bg-yellow-50 border-b border-yellow-200">
          <td colSpan={21} className="p-2">
            <div className="flex items-center gap-2">
              <input value={reason} onChange={e => setReason(e.target.value)}
                placeholder={t("Lý do override (bắt buộc — sẽ ghi audit log): VD 'Đào chốt deal 50tr với Hoa nhưng do hệ thống order sai sale_id'")}
                className="flex-1 p-1.5 border border-yellow-300 rounded text-sm" />
              <button onClick={save} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold">{t("Lưu")}</button>
              <button onClick={() => { setEditing(false); setVal(String(c.auto_total_bonus)); }} className="px-3 py-1.5 bg-gray-200 rounded text-xs">{t("Huỷ")}</button>
            </div>
            <div className="text-xs text-yellow-700 mt-1">{t("Tip: override = giá trị mới cuối cùng (không phải delta). VD muốn cộng thêm 500k thì gõ")} {fmtVND(c.auto_total_bonus + 500000)}</div>
          </td>
        </tr>
      )}
      {c.bonus_explanation && (
        <tr className="border-b border-gray-50">
          <td colSpan={21} className="px-2 pb-1 text-[10px] text-gray-500 italic sticky left-0 bg-white">{c.bonus_explanation}</td>
        </tr>
      )}
      {modal && (
        <FullEditModal c={c} autoVals={autoVals} manualEdit={manualEdit}
          onClose={() => setModal(false)}
          onSave={(f, r) => { onManualEdit(f, r); setModal(false); }}
          onClear={() => { onManualEdit(undefined, ""); setModal(false); }} />
      )}
    </>
  );
}

const DRIVER_COLS = ["gross_salary", "bonus_amount", "working_days_actual", "working_days_standard",
  "allowance_phone", "allowance_attendance", "allowance_lunch", "allowance_fuel", "allowances", "deductions",
  "dependent_count", "advance_payment"];
const DERIVED_COLS = ["salary_by_workdays", "total_income", "employee_insurance", "employer_insurance",
  "personal_deduction", "dependent_deduction", "taxable_income", "personal_income_tax", "net_salary", "total_company_cost"];

function recomputeFields(f: Record<string, string>, c: any): Record<string, string> {
  const n = (k: string) => +(f[k] || 0) || 0;

  if (c.is_hourly) {
    const hours = n("hours_worked");
    const sal = Math.round((c.hourly_rate || 0) * hours);
    const bonus = n("bonus_amount");
    const allowance = n("allowance_phone") + n("allowance_attendance") + n("allowance_lunch") + n("allowance_fuel");
    const advance = n("advance_payment");
    const totalIncome = sal + bonus;
    const net = totalIncome - advance + allowance;
    return {
      salary_by_workdays: String(sal),
      total_income: String(totalIncome),
      employee_insurance: "0",
      employer_insurance: "0",
      personal_deduction: "0",
      dependent_deduction: "0",
      taxable_income: "0",
      personal_income_tax: "0",
      net_salary: String(Math.round(net)),
      total_company_cost: String(Math.round(totalIncome + allowance)),
    };
  }

  const contract = c.contract_type || "Chính thức";
  const isTrial = /Thử việc/i.test(contract);
  const isCTV = /CTV|Part-time|Khoán|Dịch ?Vụ/i.test(contract);
  const allowance = n("allowance_phone") + n("allowance_attendance") + n("allowance_lunch") + n("allowance_fuel");
  const r = calcPayroll({
    grossSalary: n("gross_salary"),
    insuranceSalary: c.insurance_salary || c.base_salary || 0,
    workDaysStandard: n("working_days_standard") || 26,
    workDaysActual: n("working_days_actual"),
    bonus: n("bonus_amount"),
    isCTV, isTrialPeriod: isTrial,
    dependentCount: n("dependent_count"),
    advance: n("advance_payment"),
    allowance,
  } as any);
  return {
    salary_by_workdays: String(Math.round(r.salaryByWorkdays)),
    total_income: String(Math.round(r.totalIncome)),
    employee_insurance: String(Math.round(r.employeeInsurance)),
    employer_insurance: String(Math.round(r.employerInsurance)),
    personal_deduction: String(Math.round(r.personalDeduction)),
    dependent_deduction: String(Math.round(r.dependentDeduction)),
    taxable_income: String(Math.round(r.taxableIncome)),
    personal_income_tax: String(Math.round(r.tax)),
    net_salary: String(Math.round(r.netSalary)),
    total_company_cost: String(Math.round(r.totalCompanyCost)),
  };
}

function FullEditModal({ c, autoVals, manualEdit, onClose, onSave, onClear }: {
  c: any; autoVals: Record<string, number>; manualEdit?: { fields: Record<string, string>; reason: string };
  onClose: () => void; onSave: (f: Record<string, string>, r: string) => void; onClear: () => void;
}) {
  const { t } = useLang();
  const [f, setF] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    PREVIEW_COLS.forEach(col => o[col.k] = manualEdit?.fields[col.k] ?? String(Math.round(autoVals[col.k] ?? 0)));
    if (c.is_hourly) o.hours_worked = manualEdit?.fields.hours_worked ?? String(c.hours_worked ?? 0);
    return o;
  });
  const [auto, setAuto] = useState(true);
  const [reason, setReason] = useState(manualEdit?.reason ?? "");
  const [netTarget, setNetTarget] = useState("");

  const applyNet = () => {
    const target = +netTarget || 0;
    if (target <= 0) { alert(t("Nhập lương NET (> 0)")); return; }
    const contract = c.contract_type || "Chính thức";
    const isTrial = /Thử việc/i.test(contract);
    const isCTV = /CTV|Part-time|Khoán|Dịch ?Vụ/i.test(contract);
    const n = (k: string) => +(f[k] || 0) || 0;
    const wdStd = n("working_days_standard") || 26;
    const g = grossUpFromNet(target, {
      insuranceSalary: c.insurance_salary || c.base_salary || 0,
      workDaysStandard: wdStd,
      workDaysActual: wdStd,
      bonus: 0,
      isCTV, isTrialPeriod: isTrial,
      dependentCount: n("dependent_count"),
      advance: 0, allowance: 0,
    } as any);
    setAuto(true);
    setF(p => { const next = { ...p, gross_salary: String(g) }; return { ...next, ...recomputeFields(next, c) }; });
  };

  const setNum = (k: string) => (e: any) => {

    const allowDecimal = k === "working_days_actual" || k === "working_days_standard" || k === "hours_worked";
    const val = allowDecimal
      ? e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
      : e.target.value.replace(/[^\d]/g, "");
    setF(p => {
      const next = { ...p, [k]: val };

      if (auto && (DRIVER_COLS.includes(k) || k === "hours_worked")) return { ...next, ...recomputeFields(next, c) };
      return next;
    });
  };

  const submit = () => {
    if (reason.trim().length < 5) { alert(t("Nhập lý do sửa (≥5 ký tự) để lưu vết")); return; }
    onSave(f, reason);
  };

  return (
    <tr>
      <td colSpan={21} className="p-0">
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 max-h-[92vh] overflow-y-auto text-left" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-lg">{t("Sửa lương —")} {c.full_name}</h3>
              <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
            </div>
            <label className="flex items-center gap-2 mb-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={auto} onChange={e => { setAuto(e.target.checked); if (e.target.checked) setF(p => ({ ...p, ...recomputeFields(p, c) })); }} className="w-4 h-4" />
              <span className="font-medium text-emerald-700">{t("Tự tính lại các ô kết quả khi sửa")}</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">
              {auto
                ? <>{t("Chỉ cần sửa ô")} <b>{t("nền trắng")}</b> {t("(Gross, Thưởng, NC, Phụ cấp, Tạm ứng…) →")} {t("BH, thuế,")} <b>{t("Thực lĩnh")}</b>, {t("Tổng CP DN")} <b>{t("tự nhảy số")}</b>. {t("Ô")} <b className="text-gray-400">{t("xám")}</b> {t("là kết quả tự tính.")}</>
                : <span className="text-amber-600">{t("Tắt tự tính: số nhập tay ghi y nguyên khi Chốt. Tự đảm bảo các số khớp nhau.")}</span>}
            </p>

            {c.is_hourly && (
              <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-xs font-semibold text-amber-800 block mb-1">{t("⏱NV PART-TIME TRẢ THEO GIỜ — tiền công")} {fmtVND(c.hourly_rate)}{t("/giờ")}</span>
                <div className="flex gap-2 items-center">
                  <input value={f.hours_worked ?? "0"} onChange={setNum("hours_worked")} inputMode="decimal"
                    placeholder={t("Số giờ làm")} className="w-32 px-2 py-2 border border-amber-300 rounded-lg text-right tabular-nums bg-white" />
                  <span className="text-sm text-amber-800">{t("giờ ×")} {fmtVND(c.hourly_rate)} =</span>
                  <span className="font-bold text-amber-900">{fmtVND(Math.round((c.hourly_rate || 0) * (+(f.hours_worked || 0) || 0)))}</span>
                </div>
                <span className="text-[11px] text-amber-700 mt-1 block">{t("Nhập số giờ làm trong tháng → Lương theo NC, Thực lĩnh, Tổng CP DN tự tính (không BH/thuế).")}</span>
              </div>
            )}

            <div className={`mb-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200 ${c.is_hourly ? "hidden" : ""}`}>
              <span className="text-xs font-semibold text-indigo-800 block mb-1">{t("HĐ ký theo LƯƠNG NET (lương CỨNG, CHƯA gồm thưởng) → Tính Gross")}</span>
              <div className="flex gap-2 items-center">
                <input value={netTarget} onChange={e => setNetTarget(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder={t("VD 8000000")} className="flex-1 px-2 py-2 border border-indigo-300 rounded-lg text-right tabular-nums bg-white" />
                <button type="button" onClick={applyNet}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold whitespace-nowrap">{t("→ Tính Gross")}</button>
              </div>
              <span className="text-[11px] text-indigo-700 mt-1 block">{t("Net = lương cứng (sau BH+thuế). Thưởng/KPI sẽ")} <b>{t("cộng thêm")}</b> {t("→ Thực lĩnh = net + thưởng.")}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-sm">
              {PREVIEW_COLS.map(col => {
                const isDerived = auto && DERIVED_COLS.includes(col.k);
                return (
                  <label key={col.k}>
                    <span className="text-xs text-gray-500 block mb-0.5">{t(col.label)}{isDerived && <span className="text-gray-300"> {t("(tự tính)")}</span>}</span>
                    <input value={f[col.k]} onChange={setNum(col.k)} readOnly={isDerived}
                      className={`w-full px-2 py-1.5 border rounded-lg text-sm text-right tabular-nums ${isDerived ? "bg-gray-100 text-gray-500 border-gray-100" : "border-gray-200"} ${col.k === "net_salary" ? "font-bold" : ""}`} />
                  </label>
                );
              })}
            </div>
            <label className="block mt-3">
              <span className="text-xs text-gray-500 block mb-0.5">{t("Lý do sửa (bắt buộc, ≥5 ký tự)")}</span>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder={t("VD: chốt thực lĩnh theo deal thực tế")}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
            </label>
            <div className="flex justify-between gap-2 mt-4 pt-3 border-t border-gray-100">
              {manualEdit ? <button onClick={onClear} className="px-3 py-2 text-sm text-red-600">{t("Bỏ sửa tay")}</button> : <span />}
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">{t("Huỷ")}</button>
                <button onClick={submit} className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold">{t("Áp dụng")}</button>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function KPI({ label, value, color, icon: Icon, sub }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-gray-500 uppercase font-semibold">{label}</div>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-base font-bold leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
