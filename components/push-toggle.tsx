"use client";
import { useState, useEffect } from "react";
import { BellRing, BellOff, Send, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { isSalePosition } from "@/lib/auth";
import type { AppUser } from "@/lib/supabase-types";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
function b64ToU8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const IOS_GUIDE = "Chia sẻ → Thêm vào MH chính, mở từ biểu tượng rồi bấm chuông";
const DISMISS_KEY = "acme_push_banner_tat";

export function PushToggle({ user }: { user?: Pick<AppUser, "position"> | null }) {
  const { t } = useLang();
  const [state, setState] = useState<"loading" | "off" | "on" | "denied" | "ios-guide" | "unsupported">("loading");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const isSale = isSalePosition(user?.position);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (navigator as any).standalone === true;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) { setState(isIOS && !standalone ? "ios-guide" : "unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    navigator.serviceWorker.register("/sw.js").then(reg => reg.pushManager.getSubscription()).then(s => setState(s ? "on" : "off")).catch(() => setState("off"));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm === "denied") { setState("denied"); setOpen(true); setBusy(false); return; }
      if (perm !== "granted") { alert(t("Bạn cần Cho phép thông báo trong trình duyệt.")); setBusy(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC) });
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      if (r.ok) { setState("on"); setOpen(true); } else alert(t("Lưu đăng ký thất bại."));
    } catch (e: any) { alert(t("Lỗi bật thông báo:") + " " + (e?.message || e)); }
    setBusy(false);
  };
  const disable = async () => {
    setBusy(true);
    try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) { await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); } setState("off"); setOpen(false); } catch { }
    setBusy(false);
  };
  const sendTest = async () => {
    setBusy(true); setTestMsg(null);
    try {
      const r = await fetch("/api/push/test", { method: "POST" });
      const j: any = await r.json().catch(() => ({}));
      setTestMsg(r.ok ? `${t("Gửi thử")}: ${j.sent ?? 0}/${j.subs ?? 0} ${t("thiết bị")}` : `${t("Gửi thử")}: HTTP ${r.status}${j?.error ? " — " + j.error : ""}`);
    } catch (e: any) { setTestMsg(`${t("Gửi thử")}: ${e?.message || e}`); }
    setBusy(false);
  };
  const dismiss = () => { setDismissed(true); try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { } };

  const onBell = () => {
    if (state === "off") { void enable(); return; }
    if (state === "loading") return;
    setOpen(o => !o);
  };
  const on = state === "on";
  const showBanner = isSale && !dismissed && (state === "off" || state === "ios-guide");

  return (
    <div className="relative">
      <button onClick={onBell} disabled={busy || state === "loading"} title={on ? t("Tắt thông báo điện thoại") : t("Bật thông báo điện thoại")}
        className={`p-2 rounded-lg relative ${on ? "text-emerald-600 hover:bg-emerald-50" : state === "off" || state === "loading" ? "text-gray-400 hover:bg-gray-100" : "text-amber-500 hover:bg-amber-50"}`}>
        {on ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-3 text-[13px] text-gray-700 z-40 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <b className="text-gray-900">{t("Thông báo điện thoại")}</b>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-3.5 h-3.5" /></button>
          </div>
          {state === "on" && (
            <>
              <div className="flex gap-2">
                <button onClick={sendTest} disabled={busy} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" />{t("Gửi thử")}
                </button>
                <button onClick={disable} disabled={busy} className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">{t("Tắt thông báo điện thoại")}</button>
              </div>
              {testMsg && <div className="text-[12px] text-gray-600">{testMsg}</div>}
            </>
          )}
          {state === "ios-guide" && <div>{t(IOS_GUIDE)}</div>}
          {state === "denied" && <div>{t("Quyền thông báo đang bị chặn — mở lại trong cài đặt trình duyệt (Site settings → Notifications) rồi tải lại trang.")}</div>}
          {state === "unsupported" && <div>{t("Trình duyệt này không hỗ trợ thông báo đẩy.")}</div>}
        </div>
      )}

      {showBanner && (
        <div className="fixed left-0 right-0 top-14 z-20 bg-amber-50 border-b border-amber-200 px-4 py-2 text-[13px] text-amber-900 flex items-center gap-3 flex-wrap">
          <BellRing className="w-4 h-4 shrink-0" />
          {state === "off" ? (
            <button onClick={enable} disabled={busy} className="px-3 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 font-medium">{t("Bật thông báo điện thoại")}</button>
          ) : (
            <span><b>{t("Bật thông báo điện thoại")}:</b> {t(IOS_GUIDE)}</span>
          )}
          <button onClick={dismiss} className="ml-auto p-1 rounded hover:bg-amber-100 text-amber-700" title={t("Đóng")}><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
