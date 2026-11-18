"use client";
import { useState, useTransition } from "react";
import { createEmployee } from "./actions";
import { UserPlus, X, RefreshCw, Copy, CheckCircle2, Upload } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { ROLE_GAN } from "@/lib/auth";

type Dept = { id: string; name: string };

function generatePassword(): string {
  const words = ["acme", "true", "vegan", "nova", "happy", "smart", "fast", "win"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return word + num + "!";
}

export function AddEmployeeButton({ departments }: { departments: Dept[] }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState(generatePassword());
  const [createdAccount, setCreatedAccount] = useState<{ email: string; password: string; name: string } | null>(null);
  const [msg, setMsg] = useState("");

  const onSubmit = (formData: FormData) => {
    setMsg("");
    const email = String(formData.get("email") ?? "").trim();
    const name = String(formData.get("full_name") ?? "").trim();
    const pw = String(formData.get("password") ?? "");

    startTransition(async () => {
      const res = await createEmployee({
        email,
        password: pw,
        full_name: name,
        role: formData.get("role") as any,
        position: String(formData.get("position") ?? "").trim(),
        department_id: String(formData.get("department_id") ?? "") || null,
        contract_type: String(formData.get("contract_type") ?? "Chính thức"),
        base_salary: Number(formData.get("base_salary") ?? 0),
        insurance_salary: Number(formData.get("insurance_salary") ?? 0),
        max_bonus: Number(formData.get("max_bonus") ?? 0)
      });
      if (res.success) {
        setCreatedAccount({ email, password: pw, name });
        setMsg("");
      } else {
        setMsg("" + res.error);
      }
    });
  };

  const close = () => {
    if (pending) return;
    setOpen(false);
    setCreatedAccount(null);
    setPassword(generatePassword());
    setBulkMode(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-brand-700">
        <UserPlus className="w-4 h-4" /> {t("Thêm NV")}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={close}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-600" />
                {createdAccount ? t("Đã cấp tài khoản") : t("Thêm nhân viên mới")}
              </h2>
              <button onClick={close} className="p-1.5 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>

            {createdAccount ? (
              <CreatedAccountView account={createdAccount} onNewOne={() => { setCreatedAccount(null); setPassword(generatePassword()); }} onClose={close} />
            ) : bulkMode ? (
              <BulkImportView departments={departments} onCancel={() => setBulkMode(false)} onDone={close} />
            ) : (
              <>
                <div className="px-5 pt-3 flex justify-between items-center">
                  <p className="text-sm text-gray-500">{t("Tự động tạo auth account + profile + cấp password.")}</p>
                  <button onClick={() => setBulkMode(true)} className="text-sm text-brand-600 hover:underline flex items-center gap-1">
                    <Upload className="w-3 h-3" /> {t("Import nhiều NV")}
                  </button>
                </div>

                <form action={onSubmit} className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field name="full_name" label={t("Họ tên")} required placeholder={t("Nguyễn Văn A")} />
                    <Field name="email" type="email" label="Email" required placeholder="user7@example.com" />

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700">{t("Mật khẩu *")}
                        <span className="text-xs text-gray-500 ml-2">{t("(đã tự sinh, có thể đổi)")}</span>
                      </label>
                      <div className="mt-1 flex gap-2">
                        <input name="password" type="text" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                          className="flex-1 p-2.5 border border-gray-200 rounded-lg text-sm font-mono" />
                        <button type="button" onClick={() => setPassword(generatePassword())}
                          className="px-3 border border-gray-200 rounded-lg hover:bg-gray-50" title={t("Tạo password mới")}>
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <Field name="position" label={t("Chức vụ")} required placeholder="Sale / Marketing / ..." />
                    <Select name="department_id" label={t("Phòng ban")}>
                      <option value="">{t("— Chọn phòng ban —")}</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                    <Select name="role" label={t("Vai trò")} defaultValue="employee" required>
                      {ROLE_GAN.map((r) => <option key={r.value} value={r.value}>{t(r.label)}</option>)}
                    </Select>
                    <Select name="contract_type" label={t("Loại HĐ")} defaultValue={t("Chính thức")}>
                      <option>{t("Chính thức")}</option>
                      <option>{t("Thử việc")}</option>
                      <option>{t("HĐ CTV")}</option>
                      <option>{t("HĐ Dịch Vụ")}</option>
                    </Select>
                    <Field name="base_salary" type="number" label={t("Lương Gross (đ)")} required defaultValue="8000000" min={0} step={100000} />
                    <Field name="insurance_salary" type="number" label={t("Lương căn cứ BH (đ)")} defaultValue="0" min={0} step={100000} />
                    <Field name="max_bonus" type="number" label={t("Trần bonus (đ)")} defaultValue="2000000" min={0} step={100000} />
                  </div>

                  {msg && <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700">{msg}</div>}

                  <div className="flex justify-end gap-3 pt-3 border-t">
                    <button type="button" onClick={close} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">{t("Huỷ")}</button>
                    <button type="submit" disabled={pending} className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">
                      {pending ? t("Đang tạo...") : t("Cấp tài khoản")}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CreatedAccountView({ account, onNewOne, onClose }: any) {
  const { t } = useLang();
  const [copied, setCopied] = useState<string | null>(null);
  const loginUrl = typeof window !== "undefined" ? window.location.origin : "https://ikihealing-hub.example.com";

  const copy = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const zaloMessage = `${t("Tài khoản ACME Hub đã sẵn sàng cho")} ${account.name}!\n\nLink: ${loginUrl}/login\nEmail: ${account.email}\nPassword: ${account.password}\n\n${t("Đăng nhập lần đầu, đổi password ngay.")}`;

  return (
    <div className="p-5 space-y-4">
      <div className="text-center py-3">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-2" />
        <h3 className="font-bold text-lg">{t("Đã tạo tài khoản cho")} {account.name}</h3>
        <p className="text-sm text-gray-500">{t("Copy thông tin gửi NV qua Zalo")}</p>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
        <CredRow label={t("Link đăng nhập")} value={`${loginUrl}/login`} keyName="url" copied={copied} onCopy={copy} />
        <CredRow label="Email" value={account.email} keyName="email" copied={copied} onCopy={copy} />
        <CredRow label={t("Mật khẩu")} value={account.password} keyName="pass" copied={copied} onCopy={copy} mono />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-sm mb-1">{t("Tin nhắn sẵn copy gửi Zalo")}</div>
            <pre className="text-xs whitespace-pre-wrap text-gray-700 mt-2">{zaloMessage}</pre>
          </div>
          <button onClick={() => copy("zalo", zaloMessage)}
            className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 flex-shrink-0 ${copied === "zalo" ? "bg-green-100 text-green-700" : "bg-blue-600 text-white"}`}>
            {copied === "zalo" ? <><CheckCircle2 className="w-3 h-3" />{t("Copied")}</> : <><Copy className="w-3 h-3" />{t("Copy tin nhắn")}</>}
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t">
        <button onClick={onNewOne} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">{t("+ Tạo NV khác")}</button>
        <button onClick={onClose} className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold">{t("Xong")}</button>
      </div>
    </div>
  );
}

function CredRow({ label, value, keyName, copied, onCopy, mono }: any) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</div>
      <code className={`flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded text-sm break-all ${mono ? "font-mono" : ""}`}>{value}</code>
      <button onClick={() => onCopy(keyName, value)}
        className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${copied === keyName ? "bg-green-100 text-green-700" : "bg-gray-900 text-white"}`}>
        {copied === keyName ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

function BulkImportView({ departments, onCancel, onDone }: any) {
  const { t } = useLang();
  const [csv, setCsv] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [pending, startTransition] = useTransition();

  const template = `full_name,email,position,department,role,contract_type,base_salary
Nguyễn Văn A,user8@example.com,Sale,Kinh Doanh & Sale,employee,Chính thức,7000000
Trần Thị B,user9@example.com,Marketing Lead,Marketing,manager,Chính thức,12000000`;

  const runImport = () => {
    const lines = csv.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    startTransition(async () => {
      const rs = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim());
        const obj: any = {};
        headers.forEach((h, idx) => obj[h] = cols[idx]);

        const dept = departments.find((d: any) => d.name === obj.department);
        const password = "acme" + Math.floor(Math.random() * 9000 + 1000) + "!";

        const res = await createEmployee({
          full_name: obj.full_name,
          email: obj.email,
          password,
          position: obj.position,
          department_id: dept?.id || null,
          role: (obj.role || "employee") as any,
          contract_type: obj.contract_type || "Chính thức",
          base_salary: Number(obj.base_salary) || 0,
          insurance_salary: 0,
          max_bonus: 0
        });
        rs.push({ name: obj.full_name, email: obj.email, password, success: res.success, error: (res as any).error });
        setResults([...rs]);
      }
    });
  };

  return (
    <div className="p-5 space-y-4">
      <h3 className="font-bold">{t("Import nhiều NV từ CSV")}</h3>
      <p className="text-sm text-gray-600">{t("Paste CSV theo format mẫu. Password auto-generate cho mỗi NV.")}</p>

      <div className="bg-gray-100 border border-gray-200 rounded p-3 tabular-nums text-xs">
        <div className="text-gray-500 mb-1">{t("Format mẫu (copy về Excel để soạn):")}</div>
        <pre className="whitespace-pre-wrap">{template}</pre>
      </div>

      <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8}
        placeholder={t("Paste CSV vào đây...")}
        className="w-full p-3 border border-gray-200 rounded-lg text-sm font-mono" />

      {results.length > 0 && (
        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs sticky top-0">
              <tr><th className="text-left p-2">{t("Tên")}</th><th className="text-left p-2">Email</th><th className="text-left p-2">Pass</th><th className="text-left p-2">{t("Trạng thái")}</th></tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-xs">{r.email}</td>
                  <td className="p-2 text-xs tabular-nums">{r.password}</td>
                  <td className="p-2 text-xs">{r.success ? "" : "" + r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between pt-3 border-t">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">{t("← Quay lại")}</button>
        <div className="flex gap-2">
          {results.length > 0 && (
            <button onClick={onDone} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg">{t("Xong")}</button>
          )}
          <button onClick={runImport} disabled={pending || !csv} className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {pending ? `${t("Đang import")} ${results.length}...` : t("Bắt đầu import")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ name, label, type = "text", required, ...rest }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}{required && " *"}</label>
      <input name={name} type={type} required={required}
        className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
        {...rest} />
    </div>
  );
}

function Select({ name, label, children, defaultValue, required }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}{required && " *"}</label>
      <select name={name} required={required} defaultValue={defaultValue}
        className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm">{children}</select>
    </div>
  );
}
