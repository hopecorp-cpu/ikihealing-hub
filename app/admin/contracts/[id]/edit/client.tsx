"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { updateContract, ContractType } from "../../actions";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

const TYPE_OPTIONS: { v: ContractType; l: string }[] = [
  { v: "thu_viec", l: "Thử việc" },
  { v: "xac_dinh_1_nam", l: "HĐ xác định 1 năm" },
  { v: "xac_dinh_2_nam", l: "HĐ xác định 2 năm" },
  { v: "khong_xac_dinh", l: "HĐ không xác định thời hạn" },
  { v: "ctv", l: "Cộng tác viên" },
  { v: "khoan_viec", l: "Khoán việc" },
];

export function EditContractForm({ contract, departments }: { contract: any; departments: any[] }) {
  const { t } = useLang();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" | "warn" } | null>(null);

  const [form, setForm] = useState({
    contract_type: contract.contract_type as ContractType,
    effective_date: contract.effective_date,
    end_date: contract.end_date || "",
    probation_end_date: contract.probation_end_date || "",
    position: contract.position,
    department_id: contract.department_id || "",
    base_salary: Number(contract.base_salary),
    salary_pct: contract.salary_pct ?? 100,
    insurance_salary: Number(contract.insurance_salary),
    bonus_max: Number(contract.bonus_max ?? 0),
    allowance: Number(contract.allowance ?? 0),
    notes: contract.notes || "",
  });

  const hasSignature = !!contract.employee_signed_at || !!contract.employer_signed_at;
  const isTerminated = contract.status === "terminated";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTerminated) { setMsg({ text: t("HĐ đã chấm dứt, không sửa được"), type: "err" }); return; }
    if (!form.position || form.base_salary <= 0) {
      setMsg({ text: t("Cần điền chức vụ + lương"), type: "err" }); return;
    }
    startTransition(async () => {
      const res = await updateContract(contract.id, {
        contract_type: form.contract_type,
        effective_date: form.effective_date,
        end_date: form.end_date || null,
        probation_end_date: form.probation_end_date || null,
        position: form.position,
        department_id: form.department_id || null,
        base_salary: form.base_salary,
        salary_pct: form.salary_pct,
        insurance_salary: form.insurance_salary,
        bonus_max: form.bonus_max,
        allowance: form.allowance,
        notes: form.notes || undefined,
      });
      if (res.success) {
        if ((res as any).signaturesReset) {
          setMsg({ text: t("Đã lưu — Lưu ý: chữ ký cũ đã bị reset vì thay đổi field quan trọng, cần ký lại."), type: "warn" });
        } else {
          setMsg({ text: t("Đã lưu thay đổi"), type: "ok" });
        }
        setTimeout(() => router.push(`/admin/contracts/${contract.id}`), 1500);
      } else {
        setMsg({ text: "" + (res as any).error, type: "err" });
      }
    });
  };

  return (
    <form onSubmit={submit} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-6 space-y-4">
      {isTerminated && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {t("HĐ này đã chấm dứt — không thể sửa.")}
        </div>
      )}

      {hasSignature && !isTerminated && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <b className="text-amber-900">{t("Cảnh báo:")}</b> {t("HĐ này đã có chữ ký")}
            {contract.employee_signed_at && t(" của NV")}
            {contract.employer_signed_at && t(" của công ty")}.
            <div className="text-xs text-amber-700 mt-1">
              {t('Nếu anh sửa lương / loại HĐ / thời hạn / chức vụ, chữ ký cũ sẽ tự động bị reset và HĐ quay lại trạng thái "Chờ ký" — cả 2 bên cần ký lại.')}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">{t("Nhân viên")}</label>
          <div className="mt-1 p-2 border border-gray-200 rounded text-sm bg-gray-50">
            {contract.user?.full_name} <span className="text-gray-500 text-xs">{t("(không đổi)")}</span>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">{t("Loại HĐ")}</label>
          <select value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value as any })}
            disabled={isTerminated}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50">
            {TYPE_OPTIONS.map(o => <option key={o.v} value={o.v}>{t(o.l)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">{t("Hiệu lực từ")}</label>
          <input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })}
            disabled={isTerminated}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50" />
        </div>
        <div>
          <label className="text-sm font-medium">{t("Đến ngày")}</label>
          <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
            disabled={isTerminated}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50" />
        </div>
        {form.contract_type === "thu_viec" && (
          <div>
            <label className="text-sm font-medium">{t("Hết thử việc")}</label>
            <input type="date" value={form.probation_end_date} onChange={e => setForm({ ...form, probation_end_date: e.target.value })}
              disabled={isTerminated}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">{t("Chức vụ")}</label>
          <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
            disabled={isTerminated}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50" />
        </div>
        <div>
          <label className="text-sm font-medium">{t("Phòng ban")}</label>
          <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}
            disabled={isTerminated}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50">
            <option value="">{t("— Không —")}</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="border border-gray-200 rounded-lg p-3">
        <legend className="text-sm font-medium px-2">{t("Lương + phụ cấp")}</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <div>
            <label className="text-xs">{t("Lương cơ bản (đ)")}</label>
            <input type="number" value={form.base_salary} onChange={e => setForm({ ...form, base_salary: +e.target.value })}
              disabled={isTerminated}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50" />
          </div>
          {form.contract_type === "thu_viec" && (
            <div>
              <label className="text-xs">{t("% lương thử việc")}</label>
              <input type="number" min={70} max={100} value={form.salary_pct} onChange={e => setForm({ ...form, salary_pct: +e.target.value })}
                disabled={isTerminated}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50" />
              <div className="text-[10px] text-gray-500">{t("Luật ≥85%")}</div>
            </div>
          )}
          <div>
            <label className="text-xs">{t("Lương đóng BH (đ)")}</label>
            <input type="number" value={form.insurance_salary} onChange={e => setForm({ ...form, insurance_salary: +e.target.value })}
              disabled={isTerminated}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50" />
          </div>
          <div>
            <label className="text-xs">{t("Phụ cấp (đ)")}</label>
            <input type="number" value={form.allowance} onChange={e => setForm({ ...form, allowance: +e.target.value })}
              disabled={isTerminated}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50" />
          </div>
          <div>
            <label className="text-xs">{t("Thưởng tối đa (đ)")}</label>
            <input type="number" value={form.bonus_max} onChange={e => setForm({ ...form, bonus_max: +e.target.value })}
              disabled={isTerminated}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50" />
          </div>
        </div>
      </fieldset>

      <div>
        <label className="text-sm font-medium">{t("Ghi chú")}</label>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
          disabled={isTerminated}
          rows={2} className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:bg-gray-50" />
      </div>

      {msg && (
        <div className={`p-3 rounded text-sm ${
          msg.type === "ok" ? "bg-emerald-50 text-emerald-700" :
          msg.type === "warn" ? "bg-amber-50 text-amber-800" :
          "bg-red-50 text-red-700"
        }`}>{msg.text}</div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <a href={`/admin/contracts/${contract.id}`} className="px-4 py-2 border border-gray-200 rounded text-sm">{t("Huỷ")}</a>
        <button type="submit" disabled={pending || isTerminated}
          className="px-6 py-2 bg-brand-600 text-white rounded text-sm font-semibold disabled:opacity-50">
          {pending ? t("Đang lưu...") : t("Lưu thay đổi")}
        </button>
      </div>
    </form>
  );
}
