"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-client";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useLang } from "@/components/lang-provider";

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const sb = getBrowserClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setMsg({ text: error.message, type: "err" });
    else { router.push("/"); router.refresh(); }
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const sb = getBrowserClient();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
    });
    setLoading(false);
    if (error) setMsg({ text: error.message, type: "err" });
    else setMsg({ text: `${t("Đã gửi link reset đến")} ${email}. ${t("Check inbox.")}`, type: "ok" });
  };

  return (
    <form onSubmit={mode === "login" ? login : forgot} className="w-full max-w-md p-8 bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex flex-col items-center mb-6 pt-2">
        <div className="w-20 h-20 mb-3 flex items-center justify-center bg-gradient-to-br from-[#0B1F14] to-[#143020] rounded-2xl shadow-md">
          <Image src="/logo/acme-mark.svg" alt="ACME Corp" width={64} height={64} priority />
        </div>
        <h1 className="font-bold text-2xl tracking-widest" style={{ letterSpacing: "0.2em" }}>ACME</h1>
        <p className="text-xs font-semibold text-[#D4A60A] mt-1" style={{ letterSpacing: "0.4em" }}>CORP</p>
        <p className="text-xs text-gray-400 mt-2">{t("Operations Hub — Quản trị nội bộ")}</p>
      </div>

      {mode === "forgot" && (
        <button type="button" onClick={() => { setMode("login"); setMsg(null); }} className="mb-3 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {t("Quay lại đăng nhập")}
        </button>
      )}

      <h2 className="text-lg font-semibold mb-4">
        {mode === "login" ? t("Đăng nhập") : t("Quên mật khẩu")}
      </h2>

      <label className="block text-sm font-medium text-gray-700 mb-2">{t("Email công ty")}</label>
      <div className="relative mb-4">
        <Mail className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder={t("ban@example.com")} required
          className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm"
        />
      </div>

      {mode === "login" && (
        <>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t("Mật khẩu")}</label>
          <div className="relative mb-1">
            <Lock className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={t("Mật khẩu của bạn")} required minLength={6}
              className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm"
            />
          </div>
          <button type="button" onClick={() => { setMode("forgot"); setMsg(null); }} className="text-xs text-brand-600 hover:underline ml-1">
            {t("Quên mật khẩu?")}
          </button>
        </>
      )}

      {msg && (
        <div className={`mt-3 text-sm p-2 rounded ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <button type="submit" disabled={!email || (mode === "login" && !password) || loading}
        className="mt-4 w-full py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50">
        {loading ? t("Đang xử lý...") : (mode === "login" ? t("Đăng nhập") : t("Gửi link reset"))}
      </button>

      <p className="mt-4 text-xs text-gray-500 text-center">
        {mode === "login"
          ? t("Tài khoản do HR cấp. Quên password? Bấm link trên.")
          : t("Link reset sẽ gửi qua email — bấm vào link để đặt password mới.")}
      </p>
    </form>
  );
}
