"use client";
import { useState, useTransition } from "react";
import { saveCash } from "./actions";
import { useLang } from "@/components/lang-provider";

export default function CashInput({ current }: { current: number }) {
  const { t } = useLang();
  const [val, setVal] = useState(current ? String(Math.round(current / 1e6)) : "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => { const r = await saveCash(Number(val) || 0); setMsg(r.ok ? t("Đã lưu (tải lại trang)") : "" + r.error); });
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-xs text-gray-600">{t("Cập nhật tiền mặt (triệu đ):")}</label>
      <input type="number" value={val} onChange={e => setVal(e.target.value)} onFocus={e => e.target.select()} placeholder={t("vd 500")} className="p-2 border border-gray-200 rounded-lg text-sm w-32 text-right" />
      <button onClick={save} disabled={pending} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">{pending ? "…" : t("Lưu")}</button>
      {msg && <span className="text-xs">{msg}</span>}
    </div>
  );
}
