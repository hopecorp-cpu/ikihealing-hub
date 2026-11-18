"use client";
import { useState } from "react";
import { useLang } from "@/components/lang-provider";
import type { CPillar, CFilled, CStatus } from "@/lib/compliance";

const IMP: Record<string, { label: string; cls: string }> = {
  required: { label: "Bắt buộc", cls: "bg-red-50 text-red-600 border-red-200" },
  important: { label: "Quan trọng", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  nice: { label: "Nên có", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

type AutoHit = { status: CStatus; evidence: string };

export default function ComplianceClient({ pillars, statuses, items: initItems, summary: initSummary, staff, canEdit, auto = {}, autoFillable = 0 }:
  { pillars: CPillar[]; statuses: { key: string; label: string; color: string }[]; items: Record<string, CFilled>; summary: any; staff: { email: string; name: string }[]; canEdit: boolean; auto?: Record<string, AutoHit>; autoFillable?: number }) {
  const { t } = useLang();
  const [items, setItems] = useState<Record<string, CFilled>>(initItems);
  const [pillar, setPillar] = useState("");
  const [statusF, setStatusF] = useState("");
  const [onlyReqMissing, setOnlyReqMissing] = useState(false);
  const [q, setQ] = useState("");
  const [filling, setFilling] = useState(false);

  async function autofill(force = false) {
    if (filling) return;
    setFilling(true);
    try {
      const r = await fetch("/api/compliance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "autofill", force }) });
      const j = await r.json();
      if (j?.compliance?.items) setItems(j.compliance.items);
      alert(t("Đã tự điền") + ` ${j?.applied ?? 0} ` + t("mục từ dữ liệu hệ thống."));
    } catch { alert(t("Lỗi tự điền, thử lại.")); }
    setFilling(false);
  }
  const stColor = (k: string) => statuses.find(s => s.key === k)?.color || "#9CA3AF";
  const stLabel = (k: string) => statuses.find(s => s.key === k)?.label || t("Chưa đánh giá");

  const all = pillars.flatMap(p => p.items);
  const applicable = all.filter(it => (items[it.key]?.status || "") !== "na").length;
  const available = all.filter(it => items[it.key]?.status === "available").length;
  const pct = applicable ? Math.round(available / applicable * 100) : 0;
  const reqMissing = all.filter(it => it.importance === "required" && !["available", "na"].includes(items[it.key]?.status || ""));

  async function save(key: string, p: Partial<CFilled>) {
    setItems(s => ({ ...s, [key]: { ...s[key], ...p } }));
    try { await fetch("/api/compliance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveItem", key, ...{ ...items[key], ...p } }) }); } catch { }
  }

  const visible = (it: any) =>
    (!statusF || (items[it.key]?.status || "") === statusF) &&
    (!onlyReqMissing || (it.importance === "required" && !["available", "na"].includes(items[it.key]?.status || ""))) &&
    (!q || it.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3"><div className="text-2xl font-bold" style={{ color: pct >= 80 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444" }}>{pct}%</div><div className="text-[11px] text-gray-500">{t("Mức đầy đủ")} ({available}/{applicable})</div></div>
        <button onClick={() => { setStatusF("available"); setOnlyReqMissing(false); }} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 text-left"><div className="text-2xl font-bold text-emerald-600">{all.filter(it => items[it.key]?.status === "available").length}</div><div className="text-[11px] text-gray-500">{t("Đã có")}</div></button>
        <button onClick={() => { setStatusF("missing"); setOnlyReqMissing(false); }} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 text-left"><div className="text-2xl font-bold text-red-500">{all.filter(it => items[it.key]?.status === "missing").length}</div><div className="text-[11px] text-gray-500">{t("Chưa có")}</div></button>
        <button onClick={() => setOnlyReqMissing(v => !v)} className={`rounded-xl p-3 text-left border ${reqMissing.length ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}><div className="text-2xl font-bold text-red-600">{reqMissing.length}</div><div className="text-[11px] text-gray-500">{t("Bắt buộc còn thiếu")}</div></button>
      </div>

      {canEdit && Object.keys(auto).length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-indigo-900">{t("Hệ thống dò được bằng chứng cho")} <b>{Object.keys(auto).length}</b> {t("mục (nhân sự, lương, BHXH, hoá đơn MISA, ngân hàng…).")}</span>
          <button onClick={() => autofill(false)} disabled={filling || autoFillable === 0}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50">
            {filling ? t("Đang điền…") : `${t("Tự điền")} ${autoFillable} ${t("mục chưa chốt")}`}
          </button>
          <button onClick={() => { if (confirm(t("Làm mới TẤT CẢ mục tự động theo dữ liệu mới nhất? (không đụng mục bạn đã sửa tay)"))) autofill(true); }} disabled={filling}
            className="text-xs px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 disabled:opacity-50">
            {t("Làm mới dữ liệu auto")}
          </button>
          <span className="text-[11px] text-indigo-500 w-full">{t("Mục = hệ thống tự nhận; bạn có thể sửa đè bất cứ lúc nào. \"Cần rà soát\" nghĩa là có dữ liệu nhưng cần xác nhận đủ pháp lý.")}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm mục…")} className="p-2 border border-gray-200 rounded-lg text-sm flex-1 min-w-[160px]" />
        <select value={pillar} onChange={e => setPillar(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm">
          <option value="">{t("Tất cả trụ cột")}</option>
          {pillars.map(p => <option key={p.key} value={p.key}>{t(p.title)}</option>)}
        </select>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm">
          <option value="">{t("Mọi trạng thái")}</option>
          {statuses.map(s => <option key={s.key} value={s.key}>{t(s.label)}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyReqMissing} onChange={e => setOnlyReqMissing(e.target.checked)} /> {t("Bắt buộc còn thiếu")}</label>
      </div>

      {pillars.filter(p => !pillar || p.key === pillar).map(p => {
        const its = p.items.filter(visible);
        if (!its.length) return null;
        const done = p.items.filter(it => items[it.key]?.status === "available").length;
        return (
          <section key={p.key} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-sm">{p.icon} {t(p.title)}</h2>
              <span className="text-xs text-gray-400">{done}/{p.items.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {its.map(it => {
                const f = items[it.key] || {};
                return (
                  <div key={it.key} className="p-3 space-y-1.5">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{t(it.title)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${IMP[it.importance]?.cls}`}>{t(IMP[it.importance]?.label)}</span>
                      {f.reviewedAt && <span className="text-[10px] text-gray-300">{t("rà")} {f.reviewedAt.slice(0, 10)}</span>}
                    </div>
                    {it.lawRef && <div className="text-[11px] text-gray-400">{it.lawRef}</div>}
                    {auto[it.key] && (
                      <div className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-1 flex items-start gap-1 flex-wrap">
                        <span>{auto[it.key].evidence}</span>
                        {canEdit && (f.status || "") !== auto[it.key].status && (
                          <button onClick={() => save(it.key, { status: auto[it.key].status, note: t(f.note) || `${auto[it.key].evidence}` })}
                            className="underline font-medium">→ {t("áp dụng")} ({stLabel(auto[it.key].status)})</button>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select disabled={!canEdit} value={f.status || ""} onChange={e => save(it.key, { status: e.target.value as CStatus })}
                        className="text-xs border rounded-lg p-1.5 font-medium" style={{ color: stColor(f.status || ""), borderColor: stColor(f.status || "") + "55" }}>
                        <option value="">{t("— Chưa đánh giá —")}</option>
                        {statuses.map(s => <option key={s.key} value={s.key}>{t(s.label)}</option>)}
                      </select>
                      {canEdit && (
                        <select value={f.assignee || ""} onChange={e => save(it.key, { assignee: e.target.value })} className="text-xs border border-gray-200 rounded-lg p-1.5">
                          <option value="">{t("— người phụ trách —")}</option>
                          {staff.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
                        </select>
                      )}
                      <input disabled={!canEdit} defaultValue={f.link || ""} onBlur={e => { if (e.target.value !== (f.link || "")) save(it.key, { link: e.target.value }); }} placeholder={t("Link tài liệu…")} className="text-xs border border-gray-200 rounded-lg p-1.5 flex-1 min-w-[140px]" />
                      {f.link && <a href={f.link} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white">{t("Mở")} ↗</a>}
                    </div>
                    <input disabled={!canEdit} defaultValue={t(f.note) || ""} onBlur={e => { if (e.target.value !== (t(f.note) || "")) save(it.key, { note: e.target.value }); }} placeholder={t("Ghi chú…")} className="text-xs border border-gray-200 rounded-lg p-1.5 w-full" />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
