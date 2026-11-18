"use client";
import { useState } from "react";
import { useLang } from "@/components/lang-provider";
import type { MktSection } from "@/lib/mkt-strategy";

export default function StrategyClient({ sections, content: initial, canEdit }:
  { sections: MktSection[]; content: Record<string, string>; canEdit: boolean }) {
  const { t } = useLang();
  const [content, setContent] = useState<Record<string, string>>(initial || {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const filled = sections.filter(s => (content[s.key] || "").trim()).length;

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/mkt-strategy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      if (!r.ok) throw new Error((await r.json()).error || "lỗi");
      setMsg(t("✓ Đã lưu chiến lược"));
      setTimeout(() => setMsg(""), 2500);
    } catch (e: any) { setMsg(t("Lỗi: ") + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 text-sm text-gray-500">{t("Đã điền")} <b className="text-gray-800">{filled}/{sections.length}</b> {t("phần")}</div>
      {sections.map(s => (
        <section key={s.key} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
          <h2 className="font-bold text-sm">{s.icon} {t(s.title)}</h2>
          <ul className="mt-1 mb-2 text-[12px] text-gray-400 list-disc pl-5 space-y-0.5">
            {s.prompts.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <textarea disabled={!canEdit} value={content[s.key] || ""} onChange={e => setContent({ ...content, [s.key]: e.target.value })}
            rows={4} placeholder={t("Điền nội dung phần này…")} className="w-full p-2 border border-gray-200 rounded-lg text-sm leading-relaxed" />
        </section>
      ))}
      {canEdit && (
        <div className="sticky bottom-0 bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 flex items-center gap-3">
          <button onClick={save} disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">{busy ? "..." : "" + t("Lưu chiến lược")}</button>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        </div>
      )}
    </div>
  );
}
