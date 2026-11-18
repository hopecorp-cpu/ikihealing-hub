"use client";
import { useState, useTransition } from "react";
import { askCopilot } from "./actions";
import { useLang } from "@/components/lang-provider";

const SUGGEST = ["Sản phẩm nào sắp hết hàng?", "Doanh số tháng này có đạt nhịp không?", "Tôi nên ưu tiên việc gì hôm nay?", "Khách cần chăm sóc thế nào?"];

export default function Copilot({ digest }: { digest: any }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [ans, setAns] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ask = (question: string) => { if (!question.trim()) return; setErr(null); setAns(null); start(async () => { const r = await askCopilot(question, digest); if (r.ok) setAns(r.text || ""); else setErr(r.error || t("Lỗi")); }); };

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
      <div className="font-bold text-violet-900 mb-2">{t("Copilot — hỏi gì về tình hình hôm nay")}</div>
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && ask(q)} placeholder={t("VD: sale nào yếu, có nên đẩy quảng cáo không…")} className="flex-1 p-2.5 border border-gray-200 rounded-lg text-sm" />
        <button onClick={() => ask(q)} disabled={pending} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm disabled:opacity-50">{pending ? "…" : t("Hỏi")}</button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {SUGGEST.map((s, i) => <button key={i} onClick={() => { setQ(s); ask(s); }} className="text-xs px-2 py-1 bg-white border border-violet-200 rounded-md text-violet-700 hover:bg-violet-100">{t(s)}</button>)}
      </div>
      {err && <div className="text-sm text-red-600 mt-3">{err}</div>}
      {ans && <div className="bg-white border border-gray-200 rounded-lg p-3 mt-3 text-sm text-gray-700 whitespace-pre-wrap">{ans}</div>}
    </div>
  );
}
