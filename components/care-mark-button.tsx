"use client";
import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

export function CareMarkButton({ phone, name, sale, bought, initialCared, caredLast }: {
  phone: string; name?: string; sale?: string; bought?: boolean; initialCared?: boolean; caredLast?: string;
}) {
  const { t: t } = useLang();
  const [cared, setCared] = useState(!!initialCared);
  const [last, setLast] = useState(caredLast || "");
  const [busy, setBusy] = useState(false);

  const mark = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/care", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, sale_name: sale || null, flow_type: bought ? "reorder" : "notBought", current_day: 0 }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && !j.error) { const today = new Date().toISOString().slice(0, 10); setCared(true); setLast(today); }
    } catch { }
    setBusy(false);
  };

  if (cared) return (
    <span className="inline-flex items-center gap-1 text-[11px] text-teal-700 bg-teal-50 px-2 py-1 rounded-md whitespace-nowrap">
      <Check className="w-3.5 h-3.5" /> {t("Đã chăm")}{last ? ` ${last.slice(8, 10)}/${last.slice(5, 7)}` : ""}
    </span>
  );
  return (
    <button onClick={mark} disabled={busy}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-2.5 py-1 rounded-md whitespace-nowrap">
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("Đánh dấu đã chăm")}
    </button>
  );
}
