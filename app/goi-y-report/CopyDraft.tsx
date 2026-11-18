"use client";
import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CopyDraft({ text }: { text: string }) {
  const { t: t } = useLang();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2500); } catch { }
      }}
      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5"
    >
      {done ? <><Check className="w-4 h-4" /> {t("Đã copy")}</> : <><Copy className="w-4 h-4" /> {t("Copy bài đăng")}</>}
    </button>
  );
}
