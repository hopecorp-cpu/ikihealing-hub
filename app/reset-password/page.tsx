"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-client";
import { Lock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import Image from "next/image";
import { useLang } from "@/components/lang-provider";

export default function ResetPasswordPage() {
  const { t } = useLang();
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const [sanSang, setSanSang] = useState<boolean | null>(null);

  const sb = useMemo(() => getBrowserClient(), []);

  useEffect(() => {
    let huy = false;
    (async () => {
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const loiLink = h.get("error_description") || h.get("error");
      const at = h.get("access_token"), rt = h.get("refresh_token");

      if (at && rt) {
        const { error } = await sb.auth.setSession({ access_token: at, refresh_token: rt });

        window.history.replaceState(null, "", window.location.pathname);
        if (error && !huy) { setErr(error.message); setSanSang(false); return; }
      } else if (loiLink && !huy) {
        setErr(decodeURIComponent(loiLink).replace(/\+/g, " "));
      }

      const { data } = await sb.auth.getSession();
      if (!huy) setSanSang(!!data.session);
    })();
    return () => { huy = true; };
  }, [sb]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass !== confirm) { setErr(t("Mật khẩu không khớp")); return; }
    if (pass.length < 6) { setErr(t("Mật khẩu ≥6 ký tự")); return; }
    setLoading(true); setErr("");
    const { error } = await sb.auth.updateUser({ password: pass });
    setLoading(false);
    if (error) setErr(error.message);
    else {
      setDone(true);
      setTimeout(() => { router.push("/"); router.refresh(); }, 2000);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md p-8 bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex flex-col items-center mb-6 pt-2">
        <div className="w-16 h-16 mb-3 flex items-center justify-center bg-gradient-to-br from-[#0B1F14] to-[#143020] rounded-2xl shadow-md">
          <Image src="/logo/acme-mark.svg" alt="ACME Corp" width={52} height={52} priority />
        </div>
        <h1 className="font-bold text-xl">{t("Đặt mật khẩu mới")}</h1>
        <p className="text-xs text-[#D4A60A] font-semibold mt-1" style={{ letterSpacing: "0.3em" }}>ACME Corp</p>
      </div>

      {done ? (
        <div className="text-center py-6">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="font-semibold mb-1">{t("Đã đổi mật khẩu thành công!")}</h2>
          <p className="text-sm text-gray-500">{t("Đang chuyển vào hệ thống...")}</p>
        </div>
      ) : sanSang === null ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> {t("Đang kiểm tra link...")}
        </div>
      ) : sanSang === false ? (

        <div className="py-4 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="font-semibold mb-1">{t("Link không dùng được")}</h2>
          <p className="text-sm text-gray-500">
            {err || t("Link đặt lại đã hết hạn hoặc đã được dùng rồi. Mỗi link chỉ dùng được một lần.")}
          </p>
          <a href="/login" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
            {t("Quay lại đăng nhập")}
          </a>
        </div>
      ) : (
        <>
          <label className="block text-sm font-medium mb-2">{t("Mật khẩu mới")}</label>
          <div className="relative mb-4">
            <Lock className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} required minLength={6}
              className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg text-sm" />
          </div>

          <label className="block text-sm font-medium mb-2">{t("Xác nhận mật khẩu")}</label>
          <div className="relative mb-4">
            <Lock className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6}
              className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg text-sm" />
          </div>

          {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

          <button type="submit" disabled={loading || !pass || !confirm}
            className="w-full py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50">
            {loading ? t("Đang đặt...") : t("Đặt mật khẩu mới")}
          </button>
        </>
      )}
    </form>
  );
}
