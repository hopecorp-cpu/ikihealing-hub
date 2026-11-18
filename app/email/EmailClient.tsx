"use client";
import { useState } from "react";
import { useLang } from "@/components/lang-provider";
import type { EmailRec, Routing } from "@/lib/gmail";

const gmailLink = (tid: string) => `https://mail.google.com/mail/u/0/#all/${tid}`;
const CAT_CLS: Record<string, string> = {
  customer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  finance: "bg-blue-50 text-blue-700 border-blue-200",
  supplier: "bg-amber-50 text-amber-700 border-amber-200",
  partner: "bg-violet-50 text-violet-700 border-violet-200",
  other: "bg-gray-100 text-gray-500 border-gray-200",
};
const dmy = (s: string) => { try { const d = new Date(s); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; } catch { return ""; } };

export default function EmailClient({ emails: initial, routing: initRouting, staff, manager, myEmail, cats }:
  { emails: EmailRec[]; routing: Routing; staff: { email: string; name: string }[]; manager: boolean; myEmail: string; cats: { key: string; label: string }[] }) {
  const { t } = useLang();
  const label = Object.fromEntries(cats.map(c => [c.key, c.label]));
  const [emails, setEmails] = useState<EmailRec[]>(initial);
  const [routing, setRouting] = useState<Routing>(initRouting);
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [onlyAction, setOnlyAction] = useState(false);
  const [q, setQ] = useState("");
  const [showRouting, setShowRouting] = useState(false);
  const nameOf = (email: string) => staff.find(s => s.email === email)?.name || email || "—";

  async function post(body: any) {
    const r = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "lỗi");
    return r.json();
  }
  const patch = (id: string, p: Partial<EmailRec>) => setEmails(es => es.map(e => e.id === id ? { ...e, ...p } : e));
  async function assign(id: string, assignee: string) { patch(id, { assignee }); try { await post({ action: "assign", id, assignee }); } catch { } }
  async function setStat(id: string, s: EmailRec["status"]) { patch(id, { status: s }); try { await post({ action: "setStatus", id, status: s }); } catch { } }
  async function saveRouting() { try { const j = await post({ action: "setRouting", routing }); setRouting(j.routing); setShowRouting(false); } catch { } }

  const list = emails.filter(e =>
    (!cat || e.category === cat) &&
    (!status || e.status === status) &&
    (!onlyAction || (e.needsAction && e.status !== "done")) &&
    (!q || e.subject.toLowerCase().includes(q.toLowerCase()) || e.from.toLowerCase().includes(q.toLowerCase()))
  );
  const needAction = emails.filter(e => e.needsAction && e.status !== "done").length;
  const unassigned = emails.filter(e => e.needsAction && e.status !== "done" && !e.assignee).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Chip label={t("Cần xử lý")} value={needAction} color="#EF4444" onClick={() => { setOnlyAction(true); setStatus(""); setCat(""); }} />
        {manager && <Chip label={t("Chưa giao")} value={unassigned} color="#F59E0B" />}
        <Chip label={t("Tổng email")} value={emails.length} color="#6B7280" onClick={() => { setOnlyAction(false); setStatus(""); setCat(""); }} />
        <Chip label={t("Đã xong")} value={emails.filter(e => e.status === "done").length} color="#10B981" onClick={() => setStatus("done")} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm tiêu đề / người gửi…")} className="p-2 border border-gray-200 rounded-lg text-sm flex-1 min-w-[160px]" />
        <select value={cat} onChange={e => setCat(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm">
          <option value="">{t("Tất cả nhóm")}</option>
          {cats.map(c => <option key={c.key} value={c.key}>{t(c.label)}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm">
          <option value="">{t("Mọi trạng thái")}</option>
          <option value="new">{t("Mới")}</option><option value="doing">{t("Đang xử lý")}</option><option value="done">{t("Xong")}</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyAction} onChange={e => setOnlyAction(e.target.checked)} /> {t("Chỉ cần xử lý")}</label>
        {manager && <button onClick={() => setShowRouting(s => !s)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600">{t("Phân công mặc định")}</button>}
        <span className="text-xs text-gray-400 ml-auto">{list.length} {t("email")}</span>
      </div>

      {manager && showRouting && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-2">
          <div className="text-xs font-semibold text-violet-800">{t("Mặc định giao theo nhóm (email mới tự gán)")}</div>
          {cats.map(c => (
            <div key={c.key} className="flex items-center gap-2">
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${CAT_CLS[c.key]}`}>{t(c.label)}</span>
              <select value={routing[c.key] || ""} onChange={e => setRouting({ ...routing, [c.key]: e.target.value })} className="text-sm border border-gray-200 rounded-lg p-1.5 flex-1">
                <option value="">{t("— chưa giao —")}</option>
                {staff.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
              </select>
            </div>
          ))}
          <button onClick={saveRouting} className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white">{t("Lưu phân công")}</button>
        </div>
      )}

      <div className="space-y-2">
        {list.map(e => {
          const done = e.status === "done";
          return (
            <div key={e.id} className={`bg-white border rounded-xl p-3 ${done ? "opacity-60 border-gray-200" : e.needsAction ? "border-amber-200" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CAT_CLS[e.category]}`}>{label[e.category] || e.category}</span>
                    {e.needsAction && !done && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{t("cần xử lý")}</span>}
                    {e.urgency === "high" && <span className="text-[10px] text-red-600 font-semibold">{t("gấp")}</span>}
                    <span className="text-[11px] text-gray-400">{dmy(e.date)}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-800 mt-0.5 truncate">{e.subject}</div>
                  <div className="text-[11px] text-gray-500 truncate">{e.from}</div>
                  {e.snippet && <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{e.snippet}</div>}
                  {e.reason && <div className="text-[11px] text-amber-700 mt-0.5 italic">{e.reason}</div>}
                </div>
                <a href={gmailLink(e.threadId)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs px-2.5 py-1 rounded-md bg-blue-600 text-white">{t("Mở Gmail")} ↗</a>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-50 pt-2">
                {manager ? (
                  <select value={e.assignee || ""} onChange={ev => assign(e.id, ev.target.value)} className="text-xs border border-gray-200 rounded-lg p-1.5">
                    <option value="">{t("— chưa giao —")}</option>
                    {staff.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
                  </select>
                ) : <span className="text-xs text-gray-500">{nameOf(e.assignee)}</span>}
                <div className="flex gap-1 ml-auto">
                  {(["new", "doing", "done"] as const).map(s => (
                    <button key={s} onClick={() => setStat(e.id, s)} className={`text-[11px] px-2 py-1 rounded-md border ${e.status === s ? (s === "done" ? "bg-emerald-600 text-white border-emerald-600" : s === "doing" ? "bg-amber-500 text-white border-amber-500" : "bg-gray-700 text-white border-gray-700") : "bg-white border-gray-200 text-gray-500"}`}>
                      {s === "new" ? t("Mới") : s === "doing" ? t("Đang xử lý") : t("Xong")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-8 text-center text-gray-400">{t("Không có email phù hợp.")}</div>}
      </div>
    </div>
  );
}

function Chip({ label, value, color, onClick }: { label: string; value: number; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 text-left hover:bg-gray-50">
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </button>
  );
}
