"use client";
import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { editPayrollRow } from "./run/actions";
import { updateEmployeeSalary } from "./run/actions";
import { grossUpFromNet } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

const INP = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right tabular-nums focus:outline-none focus:border-brand-400";
const INP_L = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:border-brand-400";

const NUM_COLS: { k: string; label: string }[] = [
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
  { k: "deduction_penalty", label: "Khấu trừ khác" },
  { k: "net_salary", label: "THỰC LĨNH" },
  { k: "total_company_cost", label: "Tổng CP DN" },
];

const clean = (k: string, v: string) =>
  /working_days/.test(k) ? v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1") : v.replace(/[^\d]/g, "");

export function PayrollEditButton({ row }: { row: any }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const [a, setA] = useState({
    gross_salary: String(row.gross_salary ?? ""), bonus_amount: String(row.bonus_amount ?? ""),
    dependent_count: String(row.dependent_count ?? 0), advance_payment: String(row.advance_payment ?? ""),
    deduction_penalty: String(row.deduction_penalty ?? ""),
    working_days_actual: String(row.working_days_actual ?? 26), working_days_standard: String(row.working_days_standard ?? 26),
    net_override: "", note: row.note ?? "",
  });
  const [m, setM] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    NUM_COLS.forEach(c => o[c.k] = String(row[c.k] ?? 0));
    o.status = row.status ?? "approved";
    o.note = row.note ?? "";
    return o;
  });
  const [reason, setReason] = useState("");
  const [netTarget, setNetTarget] = useState("");

  const [baseSalary, setBaseSalary] = useState(String(row.users?.base_salary ?? row.base_salary ?? 0));
  const [insSalary, setInsSalary] = useState(String(row.users?.insurance_salary ?? 0));
  const [baseReason, setBaseReason] = useState("");

  const numA = (k: string) => (e: any) => setA(p => ({ ...p, [k]: clean(k, e.target.value) }));
  const numM = (k: string) => (e: any) => setM(p => ({ ...p, [k]: clean(k, e.target.value) }));

  const calcGrossFromNet = () => {
    const target = +netTarget || 0;
    if (target <= 0) { alert(t("Nhập số NET mong muốn (> 0)")); return; }
    const contract = row.users?.contract_type || "Chính thức";
    const isTrial = contract === "Thử việc";
    const isCTV = /CTV|Part-time|Khoán|Dịch ?Vụ/i.test(contract);
    const wdStd = +a.working_days_standard || 26;
    const g = grossUpFromNet(target, {
      insuranceSalary: row.users?.insurance_salary || 0,
      workDaysStandard: wdStd, workDaysActual: wdStd,
      bonus: 0, isCTV, isTrialPeriod: isTrial,
      dependentCount: +a.dependent_count || 0, advance: 0, allowance: 0,
    } as any);
    setA(p => ({ ...p, gross_salary: String(g) }));
  };

  const saveBaseSalary = () => {
    if (baseReason.trim().length < 5) { alert(t("Nhập Lý do (≥5 ký tự) trong khối Lương cơ bản để lưu vết")); return; }
    start(async () => {
      const res = await updateEmployeeSalary({
        user_id: row.user_id, base_salary: +baseSalary || 0, insurance_salary: +insSalary || 0, reason: baseReason,
      });
      if (res.success) { alert(t("Đã cập nhật lương cơ bản vào hồ sơ NV (áp dụng các tháng tính lương sau).")); router.refresh(); }
      else alert(res.error);
    });
  };

  const save = () => {
    if (reason.trim().length < 5) { alert(t("Nhập lý do sửa (≥5 ký tự) để lưu vết")); return; }
    start(async () => {
      let res;
      if (mode === "manual") {
        const fields: Record<string, any> = { status: m.status, note: m.note };
        NUM_COLS.forEach(c => fields[c.k] = +m[c.k] || 0);
        res = await editPayrollRow({ payroll_id: row.id, mode: "manual", fields, reason });
      } else {
        res = await editPayrollRow({
          payroll_id: row.id, mode: "auto",
          gross_salary: +a.gross_salary || 0, bonus_amount: +a.bonus_amount || 0,
          dependent_count: +a.dependent_count || 0, advance_payment: +a.advance_payment || 0,
          deduction_penalty: +a.deduction_penalty || 0,
          working_days_actual: +a.working_days_actual || 26, working_days_standard: +a.working_days_standard || 26,
          net_override: a.net_override.trim() ? +a.net_override : null, note: a.note, reason,
        });
      }
      if (res.success) {
        alert(`${t("Đã lưu. Thực lĩnh:")} ${Number(res.net).toLocaleString("vi-VN")}đ`);
        setOpen(false); router.refresh();
      } else alert(res.error);
    });
  };

  const modal = (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex justify-between items-center z-10">
          <h3 className="font-bold text-lg">{t("Sửa lương —")} {row.users?.full_name}</h3>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2">
            <span className="text-xs font-semibold text-emerald-800 block">{t("Lương cơ bản hợp đồng (cập nhật hồ sơ NV — áp dụng các tháng SAU)")}</span>
            <div className="grid grid-cols-2 gap-2">
              <label><span className="text-[11px] text-emerald-700 block mb-0.5">{t("Lương Gross cơ bản (đ)")}</span>
                <input value={baseSalary} onChange={e => setBaseSalary(e.target.value.replace(/[^\d]/g, ""))} className={`${INP} bg-white border-emerald-300`} /></label>
              <label><span className="text-[11px] text-emerald-700 block mb-0.5">{t("Lương căn cứ BH (đ)")}</span>
                <input value={insSalary} onChange={e => setInsSalary(e.target.value.replace(/[^\d]/g, ""))} className={`${INP} bg-white border-emerald-300`} /></label>
            </div>
            <input value={baseReason} onChange={e => setBaseReason(e.target.value)} placeholder={t("Lý do đổi lương cơ bản (≥5 ký tự, bắt buộc)")}
              className={`${INP_L} bg-white border-emerald-300`} />
            <button onClick={saveBaseSalary} disabled={pending}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50">{t("Lưu lương cơ bản vào hồ sơ")}</button>
            <span className="text-[11px] text-emerald-700 block">{t("Chỉ đổi hồ sơ NV (áp dụng tháng SAU), KHÔNG đổi phiếu tháng này.")}</span>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 text-sm">
            <button onClick={() => setMode("auto")} className={`flex-1 py-1.5 rounded-md font-medium ${mode === "auto" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>{t("Tự tính lại")}</button>
            <button onClick={() => setMode("manual")} className={`flex-1 py-1.5 rounded-md font-medium ${mode === "manual" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>{t("Sửa tay tất cả cột")}</button>
          </div>

          {mode === "auto" ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">{t("Sửa phiếu THÁNG NÀY → hệ thống tự tính BH, thuế TNCN, thực lĩnh.")}</p>
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 space-y-2">
                <span className="text-xs font-semibold text-indigo-800 block">{t("HĐ ký theo LƯƠNG NET → Tính Gross (cho phiếu tháng)")}</span>
                <div className="flex gap-2 items-center">
                  <input value={netTarget} onChange={e => setNetTarget(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder={t("VD 10000000")} className={`flex-1 ${INP} bg-white border-indigo-300`} />
                  <button type="button" onClick={calcGrossFromNet}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold whitespace-nowrap shrink-0">{t("→ Tính Gross")}</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label={t("Lương Gross")}><input value={a.gross_salary} onChange={numA("gross_salary")} className={INP} /></Field>
                <Field label={t("Thưởng / KPI")}><input value={a.bonus_amount} onChange={numA("bonus_amount")} className={INP} /></Field>
                <Field label={t("NC thực tế")}><input value={a.working_days_actual} onChange={numA("working_days_actual")} className={INP} /></Field>
                <Field label={t("NC chuẩn")}><input value={a.working_days_standard} onChange={numA("working_days_standard")} className={INP} /></Field>
                <Field label={t("Người phụ thuộc")}><input value={a.dependent_count} onChange={numA("dependent_count")} className={INP} /></Field>
                <Field label={t("Tạm ứng")}><input value={a.advance_payment} onChange={numA("advance_payment")} className={INP} /></Field>
                <Field label={t("Khấu trừ khác")} full>
                  <input value={a.deduction_penalty} onChange={numA("deduction_penalty")} placeholder={t("VD 500000 — phạt chấm công, hoàn tiền đào tạo…")} className={INP} />
                  <span className="text-[11px] text-gray-400 block mt-0.5">{t("Trừ thẳng vào thực lĩnh sau thuế. Ghi rõ vì sao ở ô Lý do bên dưới.")}</span>
                </Field>
                <Field label={t("Ấn định thực lĩnh (tuỳ chọn)")} full><input value={a.net_override} onChange={numA("net_override")} placeholder={t("Bỏ trống = tự tính")} className={INP} /></Field>
                <Field label={t("Ghi chú")} full><input value={t(a.note)} onChange={e => setA(p => ({ ...p, note: e.target.value }))} className={INP_L} /></Field>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-amber-600">{t("Chế độ tay: nhập sao lưu y vậy, KHÔNG tự tính lại.")}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {NUM_COLS.map(c => (
                  <Field key={c.k} label={t(c.label)}><input value={m[c.k]} onChange={numM(c.k)} className={INP} /></Field>
                ))}
                <Field label={t("Trạng thái")}>
                  <select value={m.status} onChange={e => setM(p => ({ ...p, status: e.target.value }))} className={INP_L}>
                    {["draft", "approved", "paid"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label={t("Ghi chú")} full><input value={t(m.note)} onChange={e => setM(p => ({ ...p, note: e.target.value }))} className={INP_L} /></Field>
              </div>
            </div>
          )}

          <Field label={t("Lý do sửa (bắt buộc, ≥5 ký tự)")} single>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder={t("VD: điều chỉnh theo doanh số thực tế")} className={INP_L} />
          </Field>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">{t("Huỷ")}</button>
          <button onClick={save} disabled={pending} className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {pending ? t("Đang lưu...") : t("Lưu phiếu tháng")}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-gray-400 hover:text-brand-600" title={t("Sửa lương")}><Pencil className="w-4 h-4" /></button>
      {open && mounted && createPortal(modal, document.body)}
    </>
  );
}

function Field({ label, children, full, single }: { label: string; children: React.ReactNode; full?: boolean; single?: boolean }) {
  return (
    <label className={single ? "block" : full ? "col-span-2 sm:col-span-3" : ""}>
      <span className="text-xs text-gray-500 block mb-0.5">{label}</span>
      {children}
    </label>
  );
}
