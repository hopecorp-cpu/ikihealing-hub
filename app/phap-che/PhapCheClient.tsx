"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { Shield, Save, Loader2, Plus, Trash2, Sparkles, AlertTriangle } from "lucide-react";
import { LEGAL_GROUPS, expiryInfo, type LegalItem, type LegalStatus } from "@/lib/legal-register";
import { saveLegalRegister, seedLegalDefaults } from "./actions";

const STATUS_LABEL: Record<LegalStatus, string> = { valid: "Còn hiệu lực", pending: "Cần bổ sung", expired: "Hết hạn", na: "Không áp dụng" };

function levelCls(level: string) {
  if (level === "expired") return "bg-red-100 text-red-700 border-red-200";
  if (level === "soon") return "bg-amber-100 text-amber-700 border-amber-200";
  if (level === "ok") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-gray-100 text-gray-500 border-gray-200";
}

export default function PhapCheClient({ items: initial, today, summary }: {
  items: LegalItem[]; today: string; summary: { expired: number; soon: number; pending: number; total: number };
}) {
  const { t: t } = useLang();
  const [items, setItems] = useState<LegalItem[]>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const patch = (id: string, p: Partial<LegalItem>) => { setItems(items.map(it => it.id === id ? { ...it, ...p } : it)); setDirty(true); };
  const add = (group: string) => { setItems([...items, { id: crypto.randomUUID(), group, name: "", status: "pending" }]); setDirty(true); };
  const del = (id: string) => { setItems(items.filter(it => it.id !== id)); setDirty(true); };

  const save = () => {
    setMsg(null);
    start(async () => {
  const { t: t } = useLang();
      const r = await saveLegalRegister(items);
      setMsg(r.ok ? { ok: true, text: t("Đã lưu sổ pháp chế") } : { ok: false, text: r.error || "Lỗi" });
      if (r.ok) setDirty(false);
    });
  };
  const seed = () => start(async () => {
    const r = await seedLegalDefaults();
    if (r.ok) location.reload(); else setMsg({ ok: false, text: r.error || "Lỗi" });
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-brand-600" /> {t("Sổ pháp chế")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Từ công ty → sản phẩm → chương trình. Theo dõi số hiệu, ngày cấp,")} <b>{t("ngày hết hạn")}</b>{t(", cơ quan cấp, người phụ trách.")}</p>
        </div>
        <button onClick={save} disabled={pending || !dirty} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("Lưu sổ")}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-red-600">{summary.expired}</div><div className="text-xs text-gray-500 mt-1">{t("Hết hạn")}</div></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-amber-600">{summary.soon + summary.pending}</div><div className="text-xs text-gray-500 mt-1">{t("Sắp hết / cần bổ sung")}</div></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-gray-800">{summary.total}</div><div className="text-xs text-gray-500 mt-1">{t("Tổng đầu mục")}</div></div>
      </div>

      {items.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">{t("Sổ đang trống. Nạp khung mẫu ngành thực phẩm bổ sung để bắt đầu.")}</p>
          <button onClick={seed} disabled={pending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {t("Nạp khung mẫu")}
          </button>
        </div>
      )}

      {LEGAL_GROUPS.map(group => {
        const rows = items.filter(it => t(it.group) === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-gray-800">{group}</h2>
              <button onClick={() => add(group)} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"><Plus className="w-3.5 h-3.5" /> {t("Thêm dòng")}</button>
            </div>
            <div className="divide-y divide-gray-100">
              {rows.length === 0 && <div className="px-4 py-3 text-xs text-gray-400">{t("Chưa có đầu mục.")}</div>}
              {rows.map(it => {
                const e = expiryInfo(it, today);
                return (
                  <div key={it.id} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <input value={it.name} onChange={ev => patch(it.id, { name: ev.target.value })} placeholder={t("Tên đầu mục")}
                        className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm font-medium" />
                      <span className={`text-[11px] px-2 py-1 rounded border font-medium whitespace-nowrap ${levelCls(e.level)}`}>
                        {e.level === "expired" && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}{t(e.label)}
                      </span>
                      <button onClick={() => del(it.id)} className="text-gray-300 hover:text-red-500 mt-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <input value={it.code || ""} onChange={ev => patch(it.id, { code: ev.target.value })} placeholder={t("Số hiệu")} className="border border-gray-200 rounded px-2 py-1 w-32" />
                      <input value={it.issuer || ""} onChange={ev => patch(it.id, { issuer: ev.target.value })} placeholder={t("Cơ quan cấp")} className="border border-gray-200 rounded px-2 py-1 w-40" />
                      <label className="flex items-center gap-1 text-gray-400">{t("cấp")}<input type="date" value={it.issueDate || ""} onChange={ev => patch(it.id, { issueDate: ev.target.value })} className="border border-gray-200 rounded px-1.5 py-1" /></label>
                      <label className="flex items-center gap-1 text-gray-400">{t("hết hạn")}<input type="date" value={it.expiryDate || ""} onChange={ev => patch(it.id, { expiryDate: ev.target.value })} className="border border-gray-200 rounded px-1.5 py-1" /></label>
                      <select value={it.status} onChange={ev => patch(it.id, { status: ev.target.value as LegalStatus })} className="border border-gray-200 rounded px-1.5 py-1">
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <input value={it.owner || ""} onChange={ev => patch(it.id, { owner: ev.target.value })} placeholder={t("Người phụ trách")} className="border border-gray-200 rounded px-2 py-1 w-32" />
                    </div>
                    <input value={t(it.note) || ""} onChange={ev => patch(it.id, { note: ev.target.value })} placeholder={t("Ghi chú")} className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-600" />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {msg && <div className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</div>}
      {dirty && <div className="text-xs text-amber-600">{t("Có thay đổi chưa lưu — bấm \"Lưu sổ\".")}</div>}
    </div>
  );
}
