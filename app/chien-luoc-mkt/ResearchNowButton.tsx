"use client";

import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { runResearchNow } from "./actions";

export default function ResearchNowButton() {
  const { t: t } = useLang();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => start(async () => {
          setMsg(null);
          const r = await runResearchNow();
          if (r.ok) { setMsg({ ok: true, text: `Xong — bản mới dài ${r.chars} ký tự` }); router.refresh(); }
          else setMsg({ ok: false, text: r.error || t("lỗi") });
        })}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-60"
      >
        <RefreshCw className={`w-4 h-4 ${pending ? "animate-spin" : ""}`} strokeWidth={2} />
        {pending ? t("Đang tra thị trường…") : t("Chạy Research ngay")}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
    </div>
  );
}
