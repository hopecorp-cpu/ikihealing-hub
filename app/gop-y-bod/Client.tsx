"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useMemo, useTransition } from "react";
import { MessageSquarePlus, ExternalLink, Loader2, Trash2, CheckCircle2, Clock, FileText, Filter } from "lucide-react";
import type { BodFeedback, FeedbackKind, FeedbackStatus } from "@/lib/bod-feedback";
import { submitFeedback, updateStatus, removeFeedback } from "./actions";

type Report = { key: string; title: string; file: string; group: "chinh" | "phu-luc" };

const KIND_LABEL: Record<FeedbackKind, string> = { khen: "Điểm hay", sua: "Cần sửa", hoi: "Câu hỏi", "rui-ro": "Rủi ro" };
const KIND_CLS: Record<FeedbackKind, string> = { khen: "bg-green-100 text-green-700", sua: "bg-amber-100 text-amber-700", hoi: "bg-blue-100 text-blue-700", "rui-ro": "bg-red-100 text-red-700" };
const STATUS_LABEL: Record<FeedbackStatus, string> = { moi: "Mới", "dang-lam": "Đang làm", xong: "Đã xong" };
const STATUS_CLS: Record<FeedbackStatus, string> = { moi: "bg-gray-100 text-gray-600", "dang-lam": "bg-blue-100 text-blue-700", xong: "bg-green-100 text-green-700" };

export default function Client({ reports, feedback: initial, canManage, canGhiNhan = true }: { reports: Report[]; feedback: BodFeedback[]; canManage: boolean; canGhiNhan?: boolean }) {
  const { t: t } = useLang();
  const [feedback, setFeedback] = useState<BodFeedback[]>(initial);
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [kind, setKind] = useState<FeedbackKind>("sua");
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const titleOf = (k: string) => reports.find(r => r.key === k)?.title || k;
  const countByReport = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of feedback) m[f.reportKey] = (m[f.reportKey] || 0) + 1;
    return m;
  }, [feedback]);
  const shown = useMemo(() => filter === "all" ? feedback : feedback.filter(f => f.status === filter), [feedback, filter]);

  const send = (reportKey: string) => {
    if (!text.trim()) { setMsg("Chưa nhập góp ý"); return; }
    setMsg(null);
    start(async () => {
      const r = await submitFeedback(reportKey, kind, text);
      if (r.ok) { setText(""); setOpenForm(null); location.reload(); }
      else setMsg(r.error || "Lỗi");
    });
  };
  const setStatus = (id: string, status: FeedbackStatus) => start(async () => {
    const r = await updateStatus(id, status);
    if (r.ok) setFeedback(feedback.map(f => f.id === id ? { ...f, status } : f));
    else setMsg(r.error || "Lỗi");
  });
  const del = (id: string) => start(async () => {
    const r = await removeFeedback(id);
    if (r.ok) setFeedback(feedback.filter(f => f.id !== id));
    else setMsg(r.error || "Lỗi");
  });

  const openCount = feedback.filter(f => f.status !== "xong").length;
  const groups: { label: string; g: "chinh" | "phu-luc" }[] = [{ label: t("Báo cáo chính"), g: "chinh" }, { label: t("Phụ lục"), g: "phu-luc" }];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquarePlus className="w-6 h-6 text-brand-600" /> {t("Góp ý BOD")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Hội đồng đọc báo cáo, để lại góp ý ngay đây. Trợ lý (Claude) đọc, thực thi và cập nhật trạng thái — góp ý không trôi mất.")} <b>{openCount}</b> {t("góp ý đang chờ xử lý.")}</p>
      </div>

      {groups.map(({ label, g }) => (
        <section key={g} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100"><h2 className="font-semibold text-sm text-gray-800">{label}</h2></div>
          <div className="divide-y divide-gray-100">
            {reports.filter(r => t(r.group) === g).map(r => (
              <div key={r.key} className="p-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-300 shrink-0" />
                  <span className="flex-1 font-medium text-sm text-gray-900">{t(r.title)}{countByReport[r.key] ? <span className="ml-2 text-xs text-gray-400">({countByReport[r.key]} {t("góp ý)")}</span> : null}</span>
                  <a href={r.file} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"><ExternalLink className="w-3.5 h-3.5" /> {t("Mở")}</a>
                  {canGhiNhan && <button onClick={() => { setOpenForm(openForm === r.key ? null : r.key); setText(""); setMsg(null); }} className="inline-flex items-center gap-1 text-xs text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-2 py-1"><MessageSquarePlus className="w-3.5 h-3.5" /> {t("Góp ý")}</button>}
                </div>
                {openForm === r.key && (
                  <div className="mt-2 pl-6 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(KIND_LABEL) as FeedbackKind[]).map(k => (
                        <button key={k} onClick={() => setKind(k)} className={`text-xs px-2 py-1 rounded border ${kind === k ? "border-brand-500 " + KIND_CLS[k] : "border-gray-200 text-gray-500"}`}>{t(KIND_LABEL[k])}</button>
                      ))}
                    </div>
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={t("Góp ý của anh/chị về báo cáo này...")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    <div className="flex items-center gap-2">
                      <button onClick={() => send(r.key)} disabled={pending} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />} {t("Gửi góp ý")}</button>
                      <button onClick={() => setOpenForm(null)} className="text-sm text-gray-500 hover:text-gray-700">{t("Huỷ")}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sm text-gray-800">{t("Tất cả góp ý (")}{feedback.length})</h2>
          <div className="flex items-center gap-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            {(["all", "moi", "dang-lam", "xong"] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)} className={`px-2 py-1 rounded ${filter === s ? "bg-brand-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>{s === "all" ? t("Tất cả") : t(STATUS_LABEL[s])}</button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {shown.length === 0 && <div className="px-4 py-8 text-center text-sm text-gray-400">{t("Chưa có góp ý nào.")}</div>}
          {shown.map(f => (
            <div key={f.id} className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${KIND_CLS[f.kind]}`}>{t(KIND_LABEL[f.kind])}</span>
                <span className="text-xs font-medium text-gray-700">{f.author}</span>
                <span className="text-xs text-gray-400">· {titleOf(f.reportKey)}</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded ml-auto ${STATUS_CLS[f.status]}`}>{t(STATUS_LABEL[f.status])}</span>
              </div>
              <p className="text-sm text-gray-800 mt-1.5 whitespace-pre-wrap">{f.text}</p>
              {f.claudeNote && <p className="text-xs text-green-700 mt-1.5 bg-green-50 border border-green-100 rounded px-2 py-1">{t("Trợ lý:")} {f.claudeNote}</p>}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[11px] text-gray-400">{new Date(f.at).toLocaleString("vi-VN")}</span>
                {canManage && (
                  <div className="flex items-center gap-2 ml-auto">
                    {f.status !== "dang-lam" && <button onClick={() => setStatus(f.id, "dang-lam")} disabled={pending} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"><Clock className="w-3.5 h-3.5" /> {t("Đang làm")}</button>}
                    {f.status !== "xong" && <button onClick={() => setStatus(f.id, "xong")} disabled={pending} className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Xong</button>}
                    <button onClick={() => del(f.id)} disabled={pending} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {msg && <div className="text-sm text-red-600">{msg}</div>}
    </div>
  );
}
