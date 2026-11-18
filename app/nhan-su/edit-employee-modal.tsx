"use client";
import { useState, useTransition, useEffect } from "react";
import { updateEmployee, adminResetPassword, getSalaryHistory } from "./actions";
import { Pencil, X, History, Key } from "lucide-react";
import { fmtVND } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";
import { ROLE_GAN } from "@/lib/auth";

type Dept = { id: string; name: string };

export function EditEmployeeButton({ user, departments }: { user: any; departments: Dept[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium">
        <Pencil className="w-3 h-3 inline" />
      </button>
      {open && <EditModal user={user} departments={departments} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditModal({ user, departments, onClose }: { user: any; departments: Dept[]; onClose: () => void }) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [tab, setTab] = useState<"edit" | "history" | "password">("edit");

  const [form, setForm] = useState({
    full_name: user.full_name ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    position: user.position ?? "",
    department_id: user.department_id ?? "",
    role: user.role ?? "employee",
    contract_type: user.contract_type ?? "Chính thức",
    work_mode: user.work_mode ?? "office",
    base_salary: user.base_salary ?? 0,
    insurance_salary: user.insurance_salary ?? 0,
    hourly_rate: user.hourly_rate ?? 0,
    max_bonus: user.max_bonus ?? 0,
    dependent_count: user.dependent_count ?? 0,
    cccd: user.cccd ?? "",
    tax_code: user.tax_code ?? "",
    reason: ""
  });

  const [history, setHistory] = useState<any[]>([]);
  const [newPass, setNewPass] = useState("");

  useEffect(() => {
    if (tab === "history") {
      startTransition(async () => {
        const data = await getSalaryHistory(user.id);
        setHistory(data);
      });
    }
  }, [tab, user.id]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateEmployee(user.id, {
        ...form,
        department_id: form.department_id || null
      } as any);
      if (res.success) {
        setMsg({ text: `${t("Đã lưu —")} ${(res as any).changesTracked || 0} ${t("thay đổi được track vào lịch sử")}`, type: "ok" });
        setTimeout(() => onClose(), 1500);
      } else {
        setMsg({ text: "" + res.error, type: "err" });
      }
    });
  };

  const resetPass = () => {
    if (!newPass || newPass.length < 6) { setMsg({ text: t("Password ≥6 ký tự"), type: "err" }); return; }
    startTransition(async () => {
      const res = await adminResetPassword(user.id, newPass);
      setMsg(res.success
        ? { text: `${t("Reset xong — pass mới:")} ${newPass} ${t("(gửi cho NV qua Zalo)")}`, type: "ok" }
        : { text: "" + res.error, type: "err" }
      );
      setNewPass("");
    });
  };

  const fieldLabel: Record<string, string> = {
    base_salary: t("Lương Gross"), insurance_salary: t("Lương BH"), hourly_rate: t("Tiền công/giờ"), max_bonus: t("Trần bonus"),
    position: t("Chức vụ"), role: t("Vai trò"), contract_type: t("Loại HĐ"), work_mode: t("Chế độ làm việc")
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !pending && onClose()}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-600" /> {t("Sửa hồ sơ:")} <b>{user.full_name}</b>
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex border-b border-gray-100 px-4">
          {[
            { v: "edit", l: t("Thông tin") },
            { v: "history", l: t("Lịch sử lương") },
            { v: "password", l: t("Reset password") }
          ].map(t => (
            <button key={t.v} onClick={() => setTab(t.v as any)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                tab === t.v ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>{t.l}</button>
          ))}
        </div>

        {tab === "edit" && (
          <form onSubmit={save} className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label={t("Họ tên *")} value={form.full_name} onChange={v => setForm({...form, full_name: v})} required />
              <Field label="Email *" type="email" value={form.email} onChange={v => setForm({...form, email: v})} required />
              <Field label={t("SĐT")} value={form.phone} onChange={v => setForm({...form, phone: v})} />
              <Field label={t("Chức vụ *")} value={form.position} onChange={v => setForm({...form, position: v})} required />
              <Select label={t("Phòng ban")} value={form.department_id} onChange={v => setForm({...form, department_id: v})}>
                <option value="">{t("— Chọn —")}</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              <Select label={t("Vai trò *")} value={form.role} onChange={v => setForm({...form, role: v as any})}>
                {ROLE_GAN.map((r) => <option key={r.value} value={r.value}>{t(r.label)}</option>)}
              </Select>
              <Select label={t("Loại HĐ")} value={form.contract_type} onChange={v => setForm({...form, contract_type: v})}>
                <option>{tDich("Chính thức")}</option><option>{tDich("Thử việc")}</option><option>{tDich("HĐ CTV")}</option><option>{tDich("HĐ Dịch Vụ")}</option>
              </Select>
              <Select label={t("Chế độ làm việc ")} value={form.work_mode} onChange={v => setForm({...form, work_mode: v})}>
                <option value="office">{t("Office — bắt buộc ở văn phòng (150m)")}</option>
                <option value="remote">{t("Remote — chấm công từ xa, không cần đến VP")}</option>
                <option value="hybrid">{t("Hybrid — cả văn phòng + remote")}</option>
              </Select>
              <Field label={t("Số NPT")} type="number" value={form.dependent_count} onChange={v => setForm({...form, dependent_count: +v})} />
              <Field label={t("Lương Gross (đ)")} type="number" step={100000} value={form.base_salary} onChange={v => setForm({...form, base_salary: +v})} />
              <Field label={t("Lương BH (đ)")} type="number" step={100000} value={form.insurance_salary} onChange={v => setForm({...form, insurance_salary: +v})} />
              <Field label={t("Tiền công/giờ (part-time, đ)")} type="number" step={5000} value={form.hourly_rate} onChange={v => setForm({...form, hourly_rate: +v})} />
              <Field label={t("Trần bonus (đ)")} type="number" step={100000} value={form.max_bonus} onChange={v => setForm({...form, max_bonus: +v})} />
              <Field label="CCCD" value={form.cccd} onChange={v => setForm({...form, cccd: v})} />
              <Field label={t("MST cá nhân")} value={form.tax_code} onChange={v => setForm({...form, tax_code: v})} />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <label className="text-sm font-medium text-yellow-900">{t("Lý do thay đổi (sẽ ghi vào lịch sử)")}</label>
              <input value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
                placeholder={t('VD: "Tăng lương sau review Q2/2026" hoặc "Đổi vị trí từ Sale sang Leader Sale"')}
                className="mt-1 w-full p-2 border border-yellow-200 rounded text-sm" />
            </div>

            {msg && (
              <div className={`p-3 rounded-lg text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">{t("Huỷ")}</button>
              <button type="submit" disabled={pending} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {pending ? t("Đang lưu...") : t("Lưu thay đổi")}
              </button>
            </div>
          </form>
        )}

        {tab === "history" && (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-sm">{t("Lịch sử thay đổi")} ({history.length})</h3>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">{t("Chưa có thay đổi nào được ghi lại")}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr><th className="text-left p-2">{t("Ngày")}</th><th className="text-left p-2">{t("Trường")}</th><th className="text-left p-2">{t("Từ")}</th><th className="text-left p-2">{t("→ Mới")}</th><th className="text-left p-2">{t("Người sửa")}</th></tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-t border-gray-100">
                      <td className="p-2 text-xs">{new Date(h.changed_at).toLocaleString("vi-VN")}</td>
                      <td className="p-2 font-medium">{fieldLabel[h.field] || h.field}</td>
                      <td className="p-2 text-red-600 text-xs">{isNaN(+h.old_value) ? h.old_value : fmtVND(+h.old_value)}</td>
                      <td className="p-2 text-green-700 text-xs font-semibold">{isNaN(+h.new_value) ? h.new_value : fmtVND(+h.new_value)}</td>
                      <td className="p-2 text-xs">{h.users?.full_name || "?"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "password" && (
          <div className="p-5 space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <Key className="w-4 h-4 inline mr-2 text-yellow-700" />
              <b>{t("Cảnh báo:")}</b> {t("NV sẽ phải login lại với password mới. Gửi password mới cho NV qua Zalo bảo mật.")}
            </div>
            <div>
              <label className="text-sm font-medium">{t("Mật khẩu mới (≥6 ký tự)")}</label>
              <input value={newPass} onChange={e => setNewPass(e.target.value)}
                placeholder={t("VD: matkhau-tam-2026")}
                className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            {msg && (
              <div className={`p-3 rounded-lg text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>
            )}
            <button onClick={resetPass} disabled={pending || !newPass} className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {pending ? t("Đang reset...") : t("Reset password ngay")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, step }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} required={required} step={step}
        className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
    </div>
  );
}

function Select({ label, value, onChange, children }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <select value={value ?? ""} onChange={e => onChange(e.target.value)} className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">{children}</select>
    </div>
  );
}
