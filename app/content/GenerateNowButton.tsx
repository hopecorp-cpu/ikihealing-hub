"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { generateDraftsNow } from "./actions";

export default function GenerateNowButton() {
  const { t: t } = useLang();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      try {
        const r = await generateDraftsNow(2);
        if (r.ok) {
          const warn = r.flagged && r.flagged.length ? ` — cần soi kỹ: ${r.flagged.join(", ")}` : "";
          const tele = r.pushed ? ` Đã gửi ${r.pushed} bài vào Telegram của anh kèm nút Duyệt & Đăng — mở Telegram bấm duyệt là bài lên fanpage.` : "";
          setMsg({ ok: true, text: `Đã tạo ${r.saved} bài nháp${warn}.${tele}` });
        } else {
          setMsg({ ok: false, text: r.error || "Chưa đẻ được bài" });
        }
      } catch (e: any) {
        setMsg({ ok: false, text: String(e?.message || e).slice(0, 120) });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {pending ? t("AI đang viết…") : t("Tạo bài ngay")}
      </button>
      {msg && (
        <span className={`text-xs max-w-xs text-right ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>
      )}
    </div>
  );
}
