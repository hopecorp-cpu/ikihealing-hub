"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition, useEffect } from "react";
import { createContract, ContractType } from "../actions";
import { useRouter } from "next/navigation";

const TYPE_OPTIONS: { v: ContractType; l: string; defaultDuration: number | null }[] = [
  { v: "thu_viec", l: "Thử việc (2 tháng)", defaultDuration: 60 },
  { v: "xac_dinh_1_nam", l: "HĐ xác định 1 năm", defaultDuration: 365 },
  { v: "xac_dinh_2_nam", l: "HĐ xác định 2 năm", defaultDuration: 730 },
  { v: "khong_xac_dinh", l: "HĐ không xác định thời hạn", defaultDuration: null },
  { v: "ctv", l: "Cộng tác viên", defaultDuration: 180 },
  { v: "khoan_viec", l: "Khoán việc", defaultDuration: 30 },
];

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function NewContractForm({ users, departments, preSelectedUserId }: any) {
  const { t } = useLang();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    user_id: preSelectedUserId || "",
    contract_type: "thu_viec" as ContractType,
    effective_date: today,
    end_date: "",
    probation_end_date: "",
    position: "",
    department_id: "",
    base_salary: 0,
    salary_pct: 85,
    insurance_salary: 0,
    bonus_max: 0,
    allowance: 0,
    notes: "",
  });

  useEffect(() => {
    if (!form.user_id) return;
    const u = users.find((x: any) => x.id === form.user_id);
    if (!u) return;
    setForm(f => ({
      ...f,
      position: u.position || f.position,
      department_id: u.department_id || f.department_id,
      base_salary: u.base_salary || f.base_salary,
      insurance_salary: u.insurance_salary || f.insurance_salary,
      bonus_max: u.max_bonus || f.bonus_max,
      effective_date: u.hire_date || f.effective_date,
    }));
  }, [form.user_id]);

  useEffect(() => {
    const opt = TYPE_OPTIONS.find(o => o.v === form.contract_type);
    if (!opt) return;
    if (opt.defaultDuration === null) {
      setForm(f => ({ ...f, end_date: "", probation_end_date: f.contract_type === "thu_viec" ? addDays(f.effective_date, 60) : "" }));
    } else if (form.contract_type === "thu_viec") {
      setForm(f => ({ ...f, end_date: addDays(f.effective_date, opt.defaultDuration!), probation_end_date: addDays(f.effective_date, 60) }));
    } else {
      setForm(f => ({ ...f, end_date: addDays(f.effective_date, opt.defaultDuration!), probation_end_date: "" }));
    }
  }, [form.contract_type, form.effective_date]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id || !form.position || form.base_salary <= 0) {
      setMsg(t("Cần điền NV + chức vụ + lương"));
      return;
    }
    startTransition(async () => {
      const res = await createContract({
        user_id: form.user_id,
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
        setMsg(`${t("Đã tạo HĐ")} ${(res as any).contract_number} ${t("— đang chuyển sang trang chi tiết...")}`);
        setTimeout(() => router.push(`/admin/contracts/${(res as any).id}`), 800);
      } else {
        setMsg("" + (res as any).error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">{t("Nhân viên *")}</label>
          <select required value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
            <option value="">{t("— Chọn NV —")}</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.full_name} ({u.position || "—"})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{t("Loại HĐ *")}</label>
          <select value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value as any })}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
            {TYPE_OPTIONS.map(o => <option key={o.v} value={o.v}>{t(o.l)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">{t("Hiệu lực từ *")}</label>
          <input type="date" required value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">{t("Đến ngày")}</label>
          <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          <div className="text-xs text-gray-500 mt-0.5">{t("Để trống = vô thời hạn")}</div>
        </div>
        {form.contract_type === "thu_viec" && (
          <div>
            <label className="text-sm font-medium">{t("Hết thử việc")}</label>
            <input type="date" value={form.probation_end_date} onChange={e => setForm({ ...form, probation_end_date: e.target.value })}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">{t("Chức vụ *")}</label>
          <input required value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
            placeholder="Marketing Executive"
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">{t("Phòng ban")}</label>
          <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
            <option value="">{t("— Chọn —")}</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="border border-gray-200 rounded-lg p-3">
        <legend className="text-sm font-medium px-2">{t("Lương + phụ cấp")}</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <div>
            <label className="text-xs">{t("Lương cơ bản (đ) *")}</label>
            <input type="number" required value={form.base_salary} onChange={e => setForm({ ...form, base_salary: +e.target.value })}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>
          {form.contract_type === "thu_viec" && (
            <div>
              <label className="text-xs">{t("% lương thử việc")}</label>
              <input type="number" min={70} max={100} value={form.salary_pct} onChange={e => setForm({ ...form, salary_pct: +e.target.value })}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
              <div className="text-[10px] text-gray-500">{t("Luật ≥85%")}</div>
            </div>
          )}
          <div>
            <label className="text-xs">{t("Lương đóng BH (đ)")}</label>
            <input type="number" value={form.insurance_salary} onChange={e => setForm({ ...form, insurance_salary: +e.target.value })}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs">{t("Phụ cấp (đ)")}</label>
            <input type="number" value={form.allowance} onChange={e => setForm({ ...form, allowance: +e.target.value })}
              placeholder={t("Ăn trưa, đi lại")}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs">{t("Thưởng tối đa (đ)")}</label>
            <input type="number" value={form.bonus_max} onChange={e => setForm({ ...form, bonus_max: +e.target.value })}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>
        </div>
      </fieldset>

      <div>
        <label className="text-sm font-medium">{t("Ghi chú")}</label>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={2} placeholder={t("Điều khoản đặc biệt, NDA...")}
          className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
      </div>

      {msg && <div className="text-sm">{msg}</div>}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <a href="/admin/contracts" className="px-4 py-2 border border-gray-200 rounded text-sm">{t("Huỷ")}</a>
        <button type="submit" disabled={pending}
          className="px-6 py-2 bg-brand-600 text-white rounded text-sm font-semibold disabled:opacity-50">
          {pending ? t("Đang tạo...") : t("Tạo HĐ")}
        </button>
      </div>
    </form>
  );
}
