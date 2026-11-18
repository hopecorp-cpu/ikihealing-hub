"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { FolderKanban, Check, AlertTriangle, Plus, ExternalLink } from "lucide-react";
import { touchProjectAction, setStatusAction, addProjectAction } from "./portfolio-actions";

type Item = {
  id: string; name: string; area: string; status: string; priority: string;
  nextStep: string; lastUpdate: string; link?: string; makesMoney?: boolean;
};
const STALE_DAYS: Record<string, number> = { urgent: 5, high: 8, medium: 14, low: 25 };
const daysSince = (d: string) => { try { return Math.max(0, Math.round((Date.now() - new Date(d + "T00:00:00").getTime()) / 864e5)); } catch { return 999; } };
const isStale = (p: Item) => p.status !== "done" && p.status !== "paused" && daysSince(p.lastUpdate) >= (STALE_DAYS[p.priority] ?? 14);

const STATUS_LABEL: Record<string, string> = { idea: "Ý tưởng", building: "Đang build", active: "Đang chạy", paused: "Tạm dừng", done: "Xong" };
const STATUS_COLOR: Record<string, string> = { idea: "bg-gray-100 text-gray-600", building: "bg-indigo-100 text-indigo-700", active: "bg-green-100 text-green-700", paused: "bg-yellow-100 text-yellow-700", done: "bg-blue-100 text-blue-700" };
const PRI_COLOR: Record<string, string> = { low: "text-gray-500", medium: "text-blue-600", high: "text-orange-600", urgent: "text-red-600 font-bold" };
const AREAS = ["NOVA App", "ACME Ops", "Sale Page", "Marketing", "Thương hiệu", "Đào tạo", "Khác"];

export default function PortfolioCockpit({ items }: { items: Item[] }) {
  const { t: t } = useLang();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const staleCount = items.filter(isStale).length;
  const running = items.filter((p) => p.status !== "done").length;
  const money = items.filter((p) => p.makesMoney).length;

  const byArea = AREAS.map((a) => ({ area: a, list: items.filter((p) => p.area === a) })).filter((g) => g.list.length);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
        <h2 className="font-bold flex items-center gap-2"><FolderKanban className="w-5 h-5 text-brand-600" /> {t("Danh mục dự án (toàn cảnh)")}</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-green-50 text-green-700">{running} {t("đang chạy")}</span>
          {staleCount > 0 && <span className="px-2 py-1 rounded bg-red-50 text-red-700 font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {staleCount} {t("bỏ bẵng")}</span>}
          <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">{money} {t("ra tiền")}</span>
          <button onClick={() => setShowAdd((s) => !s)} className="px-2.5 py-1 rounded bg-brand-600 text-white flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> {t("Thêm")}</button>
        </div>
      </div>

      {showAdd && <AddForm onDone={() => setShowAdd(false)} pending={pending} start={start} />}

      <p className="text-xs text-gray-500 mb-3">{t("Trợ lý TGĐ đọc bảng này để nhắc dự án lâu chưa động tới. Bấm")} <b>{t("“Vừa làm”")}</b> {t("mỗi khi anh chạm vào dự án để nó khỏi báo bỏ bẵng.")}</p>

      <div className="space-y-5">
        {byArea.map((g) => (
          <div key={g.area}>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">{g.area}</div>
            <div className="space-y-2">
              {g.list.map((p) => {
  const { t: t } = useLang();
                const stale = isStale(p);
                const d = daysSince(p.lastUpdate);
                return (
                  <div key={p.id} className={`rounded-xl border p-3 ${stale ? "border-red-200 bg-red-50/40" : "border-gray-100 bg-gray-50/50"}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{p.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLOR[p.status] || "bg-gray-100"}`}>{t(STATUS_LABEL[p.status]) || p.status}</span>
                          <span className={`text-[10px] ${PRI_COLOR[p.priority] || ""}`}>{p.priority}</span>
                          {p.makesMoney && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">{t("ra tiền")}</span>}
                          {p.link && <a href={p.link} target="_blank" className="text-brand-600"><ExternalLink className="w-3.5 h-3.5" /></a>}
                        </div>
                        {editing === p.id ? (
                          <div className="flex gap-1 mt-1.5">
                            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1 text-xs border rounded px-2 py-1" placeholder={t("Việc kế tiếp…")} />
                            <button onClick={() => start(async () => { await touchProjectAction(p.id, draft); setEditing(null); })} className="text-xs px-2 py-1 rounded bg-brand-600 text-white">{t("Lưu")}</button>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-600 mt-1">→ {p.nextStep || <span className="italic text-gray-400">{t("chưa ghi việc kế tiếp")}</span>}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`text-[11px] ${stale ? "text-red-600 font-semibold" : "text-gray-400"}`}>{d}{t("n trước")}</span>
                        <button disabled={pending} onClick={() => start(async () => { await touchProjectAction(p.id); })} title={t("Đánh dấu vừa làm hôm nay")} className="text-[11px] px-2 py-1 rounded border border-green-200 text-green-700 bg-white flex items-center gap-1 hover:bg-green-50"><Check className="w-3 h-3" /> {t("Vừa làm")}</button>
                        <button onClick={() => { setEditing(editing === p.id ? null : p.id); setDraft(p.nextStep || ""); }} className="text-[11px] px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50">{t("Sửa")}</button>
                        {p.status !== "done" && <button disabled={pending} onClick={() => start(async () => { await setStatusAction(p.id, "done"); })} className="text-[11px] px-2 py-1 rounded border border-blue-200 text-blue-700 bg-white hover:bg-blue-50">Xong</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddForm({ onDone, pending, start }: { onDone: () => void; pending: boolean; start: (fn: () => Promise<void>) => void }) {
  const { t: t } = useLang();
  const [name, setName] = useState(""); const [area, setArea] = useState("ACME Ops"); const [pri, setPri] = useState("medium"); const [step, setStep] = useState("");
  return (
    <div className="mb-4 p-3 rounded-xl border border-brand-200 bg-brand-50/40 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Tên dự án")} className="text-sm border rounded px-2 py-1.5" />
        <select value={area} onChange={(e) => setArea(e.target.value)} className="text-sm border rounded px-2 py-1.5">{AREAS.map((a) => <option key={t(a)}>{t(a)}</option>)}</select>
        <select value={pri} onChange={(e) => setPri(e.target.value)} className="text-sm border rounded px-2 py-1.5"><option value="urgent">urgent</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option></select>
        <input value={step} onChange={(e) => setStep(e.target.value)} placeholder={t("Việc kế tiếp")} className="text-sm border rounded px-2 py-1.5" />
      </div>
      <div className="flex gap-2">
        <button disabled={pending || !name.trim()} onClick={() => start(async () => { await addProjectAction(name, area, pri as any, step); onDone(); })} className="text-xs px-3 py-1.5 rounded bg-brand-600 text-white disabled:opacity-50">{t("Thêm dự án")}</button>
        <button onClick={onDone} className="text-xs px-3 py-1.5 rounded border">{t("Huỷ")}</button>
      </div>
    </div>
  );
}
