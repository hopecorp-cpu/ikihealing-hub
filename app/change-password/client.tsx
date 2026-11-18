"use client";
import { useState, useTransition } from "react";
import { changeMyPassword } from "./actions";
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { useLang } from "@/components/lang-provider";

export function ChangePasswordForm({ email, name }: { email: string; name: string }) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [done, setDone] = useState(false);

  const strength = checkStrength(form.next);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.next !== form.confirm) { setMsg({ text: t("Mật khẩu mới + xác nhận không khớp"), type: "err" }); return; }
    if (form.next.length < 6) { setMsg({ text: t("Mật khẩu mới phải ≥6 ký tự"), type: "err" }); return; }

    startTransition(async () => {
      const res = await changeMyPassword({ current_password: form.current, new_password: form.next });
      if (res.success) {
        setMsg({ text: t("Đổi mật khẩu thành công! Mật khẩu mới đã được lưu vào hệ thống."), type: "ok" });
        setDone(true);
        setForm({ current: "", next: "", confirm: "" });
      } else {
        setMsg({ text: "" + (res.error || ""), type: "err" });
      }
    });
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
            <Key className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t("Đổi mật khẩu")}</h1>
            <p className="text-xs text-gray-500">{name} · {email}</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 my-4">
          <b>{t("Mẹo:")}</b> {t("chọn mật khẩu dễ nhớ nhưng khó đoán. VD:")} <code>ACME Corp2026!</code> {t("hoặc")} <code>sanphama@hp</code>.
          {" "}{t("Lưu ngay vào")} <b>Google Password / iCloud Keychain</b> {t("để không quên.")}
        </div>

        {done ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
            <h2 className="font-bold text-lg">{t("Đổi mật khẩu xong!")}</h2>
            <p className="text-sm text-gray-600 mt-1">{t("Lần sau login dùng mật khẩu mới nhé")}</p>
            <a href="/" className="inline-block mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold">{t("Về trang chủ")}</a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <PasswordInput
              label={t("Mật khẩu hiện tại *")}
              value={form.current}
              onChange={v => setForm({...form, current: v})}
              show={show.current}
              onToggle={() => setShow({...show, current: !show.current})}
              placeholder={t("Mật khẩu bạn đang dùng")}
              autoComplete="current-password"
            />

            <PasswordInput
              label={t("Mật khẩu mới *")}
              value={form.next}
              onChange={v => setForm({...form, next: v})}
              show={show.next}
              onToggle={() => setShow({...show, next: !show.next})}
              placeholder={t("Tối thiểu 6 ký tự")}
              autoComplete="new-password"
            />

            {form.next && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("Độ mạnh:")}</span>
                  <span className={strength.color}>{t(strength.label)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${strength.barColor}`} style={{ width: `${strength.score * 25}%` }} />
                </div>
                {strength.suggestions.length > 0 && (
                  <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
                    {strength.suggestions.map((s, i) => <li key={i}>• {t(s)}</li>)}
                  </ul>
                )}
              </div>
            )}

            <PasswordInput
              label={t("Nhập lại mật khẩu mới *")}
              value={form.confirm}
              onChange={v => setForm({...form, confirm: v})}
              show={show.confirm}
              onToggle={() => setShow({...show, confirm: !show.confirm})}
              placeholder={t("Nhập lại mật khẩu mới để xác nhận")}
              autoComplete="new-password"
            />

            {form.confirm && form.next && form.confirm !== form.next && (
              <div className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {t("Không khớp với mật khẩu mới")}
              </div>
            )}

            {msg && (
              <div className={`p-3 rounded text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {msg.text}
              </div>
            )}

            <button type="submit" disabled={pending || !form.current || !form.next || !form.confirm || form.next !== form.confirm}
              className="w-full py-3 bg-brand-600 text-white rounded-lg font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4" /> {pending ? t("Đang đổi...") : t("Đổi mật khẩu ngay")}
            </button>

            <div className="text-xs text-gray-500 text-center pt-2 border-t">
              {t("Quên mật khẩu hiện tại? → Liên hệ admin (CEO) qua Zalo để reset")}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordInput({ label, value, onChange, show, onToggle, placeholder, autoComplete }: any) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full p-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button type="button" onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function checkStrength(pass: string): { score: number; label: string; color: string; barColor: string; suggestions: string[] } {
  const { t: t } = useLang();
  let score = 0;
  const suggestions: string[] = [];
  if (pass.length >= 8) score++; else suggestions.push("Nên ≥8 ký tự");
  if (/[A-Z]/.test(pass)) score++; else suggestions.push("Nên có chữ HOA");
  if (/[0-9]/.test(pass)) score++; else suggestions.push("Nên có số");
  if (/[^a-zA-Z0-9]/.test(pass)) score++; else suggestions.push("Nên có ký tự đặc biệt (! @ # ...)");

  if (score <= 1) return { score: 1, label: t("Yếu"), color: "text-red-600", barColor: "bg-red-500", suggestions };
  if (score === 2) return { score: 2, label: t("Trung bình"), color: "text-orange-600", barColor: "bg-orange-500", suggestions };
  if (score === 3) return { score: 3, label: t("Khá"), color: "text-yellow-600", barColor: "bg-yellow-500", suggestions };
  return { score: 4, label: t("Mạnh ✓"), color: "text-green-600", barColor: "bg-green-500", suggestions: [] };
}
