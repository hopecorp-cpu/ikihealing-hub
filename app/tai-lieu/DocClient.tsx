"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useMemo, useTransition } from "react";
import { FolderOpen, Search, Save, Loader2, Plus, Trash2, Sparkles, ExternalLink, CheckCircle2, X, FileText, ChevronDown, Lightbulb } from "lucide-react";
import { DOC_CATEGORIES, filterDocs, type DocItem } from "@/lib/doc-registry";
import type { DistillProposal } from "@/lib/distill";
import { saveDocs, seedDocs, approveProposal, dismissProposal } from "./actions";

export default function DocClient({ docs: initial, canEdit, proposals: initialProposals = [] }: { docs: DocItem[]; canEdit: boolean; proposals?: DistillProposal[] }) {
  const { t: t } = useLang();
  const [docs, setDocs] = useState<DocItem[]>(initial);
  const [proposals, setProposals] = useState<DistillProposal[]>(initialProposals);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openBody, setOpenBody] = useState<string | null>(null);

  const filtered = useMemo(() => filterDocs(docs, q), [docs, q]);
  const patch = (id: string, p: Partial<DocItem>) => { setDocs(docs.map(d => d.id === id ? { ...d, ...p } : d)); setDirty(true); };
  const add = (category: string) => { setDocs([...docs, { id: crypto.randomUUID(), category, title: "" }]); setDirty(true); };
  const del = (id: string) => { setDocs(docs.filter(d => d.id !== id)); setDirty(true); };

  const save = () => { setMsg(null); start(async () => {
  const { t: t } = useLang(); const r = await saveDocs(docs); setMsg(r.ok ? { ok: true, text: t("Đã lưu") } : { ok: false, text: r.error || "Lỗi" }); if (r.ok) setDirty(false); }); };
  const seed = () => start(async () => { const r = await seedDocs(); if (r.ok) location.reload(); else setMsg({ ok: false, text: r.error || "Lỗi" }); });

  const approve = (p: DistillProposal) => { setMsg(null); start(async () => {
    const r = await approveProposal(p);
    if (r.ok) { setProposals(proposals.filter(x => x.id !== p.id)); location.reload(); }
    else setMsg({ ok: false, text: r.error || "Lỗi" });
  }); };
  const dismiss = (id: string) => start(async () => { const r = await dismissProposal(id); if (r.ok) setProposals(proposals.filter(x => x.id !== id)); else setMsg({ ok: false, text: r.error || "Lỗi" }); });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FolderOpen className="w-6 h-6 text-brand-600" /> {t("Trung tâm tài liệu")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Một nơi tìm mọi tài liệu — quy trình, chính sách, hợp đồng, thương hiệu, pháp lý.")}</p>
        </div>
        {canEdit && <button onClick={save} disabled={pending || !dirty} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("Lưu")}</button>}
      </div>

      {canEdit && proposals.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-sm text-amber-900">{t("Đề xuất tự đúc kết — chờ duyệt")} <span className="font-normal text-amber-700">({proposals.length})</span></h2>
          </div>
          <p className="px-4 pt-2 text-xs text-amber-700">{t("Hệ đọc dữ liệu đúc kết (bài học AI, bài loại, ghi nhớ điều hành) và soạn sẵn thành bản nháp SOP/quy định. Bấm")} <b>{t("Duyệt")}</b> {t("để thành tài liệu chính thức, hoặc")} <b>{t("Bỏ qua")}</b>.</p>
          <div className="divide-y divide-amber-100 mt-1">
            {proposals.map(p => (
              <div key={p.id} className="p-3">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">{t(p.title)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{p.category} {t("· nguồn:")} {p.sourceLabel} · {p.count} {t("điểm dữ liệu")}</div>
                    <button onClick={() => setOpenBody(openBody === p.id ? null : p.id)} className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 mt-1"><ChevronDown className={`w-3.5 h-3.5 transition-transform ${openBody === p.id ? "rotate-180" : ""}`} /> {openBody === p.id ? t("Ẩn nội dung") : t("Xem nội dung")}</button>
                    {openBody === p.id && <pre className="mt-2 text-xs text-gray-700 bg-white border border-amber-100 rounded-lg p-3 whitespace-pre-wrap font-sans">{p.body}</pre>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => approve(p)} disabled={pending} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"><CheckCircle2 className="w-3.5 h-3.5" /> {t("Duyệt")}</button>
                    <button onClick={() => dismiss(p.id)} disabled={pending} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X className="w-3.5 h-3.5" /> {t("Bỏ qua")}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm tài liệu theo tên, từ khoá, phòng ban...")} className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
      </div>

      {docs.length === 0 && canEdit && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">{t("Chưa có tài liệu. Nạp khung mẫu (trỏ sẵn tới các trang nội bộ) rồi bổ sung link Drive.")}</p>
          <button onClick={seed} disabled={pending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {t("Nạp khung mẫu")}</button>
        </div>
      )}
      {docs.length === 0 && !canEdit && <div className="text-center text-gray-400 py-10">{t("Chưa có tài liệu nào.")}</div>}

      {DOC_CATEGORIES.map(cat => {
        const rows = filtered.filter(d => d.category === cat);
        if (docs.length === 0) return null;
        if (rows.length === 0 && (q || !canEdit)) return null;
        return (
          <section key={cat} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-gray-800">{cat} <span className="text-gray-400 font-normal">({rows.length})</span></h2>
              {canEdit && <button onClick={() => add(cat)} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"><Plus className="w-3.5 h-3.5" /> {t("Thêm")}</button>}
            </div>
            <div className="divide-y divide-gray-100">
              {rows.length === 0 && <div className="px-4 py-3 text-xs text-gray-400">{t("Chưa có tài liệu.")}</div>}
              {rows.map(d => canEdit ? (
                <div key={d.id} className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <input value={t(d.title)} onChange={e => patch(d.id, { title: e.target.value })} placeholder={t("Tên tài liệu")} className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm font-medium" />
                    {d.source === "distilled" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 mt-1.5 shrink-0">{t("đúc kết")}</span>}
                    <button onClick={() => del(d.id)} className="text-gray-300 hover:text-red-500 mt-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <input value={d.url || ""} onChange={e => patch(d.id, { url: e.target.value })} placeholder="Link (Drive / /trang-noi-bo)" className="border border-gray-200 rounded px-2 py-1 flex-1 min-w-[200px]" />
                    <input value={d.owner || ""} onChange={e => patch(d.id, { owner: e.target.value })} placeholder={t("Phụ trách")} className="border border-gray-200 rounded px-2 py-1 w-28" />
                    <input value={d.tags || ""} onChange={e => patch(d.id, { tags: e.target.value })} placeholder={t("Từ khoá")} className="border border-gray-200 rounded px-2 py-1 w-32" />
                    <select value={d.access || "all"} onChange={e => patch(d.id, { access: e.target.value as DocItem["access"] })} className="border border-gray-200 rounded px-1.5 py-1">
                      <option value="all">{t("Mọi người")}</option><option value="manager">{t("Quản lý")}</option><option value="ceo">CEO</option>
                    </select>
                  </div>
                  {d.body && (
                    <div>
                      <button onClick={() => setOpenBody(openBody === d.id ? null : d.id)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronDown className={`w-3.5 h-3.5 transition-transform ${openBody === d.id ? "rotate-180" : ""}`} /> {openBody === d.id ? t("Ẩn nội dung") : t("Xem nội dung")}</button>
                      {openBody === d.id && <pre className="mt-1.5 text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap font-sans">{d.body}</pre>}
                    </div>
                  )}
                </div>
              ) : d.body && !d.url ? (
                <div key={d.id} className="px-4 py-2.5">
                  <button onClick={() => setOpenBody(openBody === d.id ? null : d.id)} className="w-full flex items-center gap-2 text-sm hover:bg-gray-50 text-left">
                    <FileText className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <span className="flex-1 font-medium text-gray-900">{t(d.title)}</span>
                    {d.owner && <span className="text-xs text-gray-400">{d.owner}</span>}
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform ${openBody === d.id ? "rotate-180" : ""}`} />
                  </button>
                  {openBody === d.id && <pre className="mt-2 text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap font-sans">{d.body}</pre>}
                </div>
              ) : (
                <a key={d.id} href={d.url || "#"} target={d.url?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="px-4 py-2.5 flex items-center gap-2 text-sm hover:bg-gray-50">
                  <span className="flex-1 font-medium text-gray-900">{t(d.title)}</span>
                  {d.owner && <span className="text-xs text-gray-400">{d.owner}</span>}
                  {d.url && <ExternalLink className="w-3.5 h-3.5 text-gray-300" />}
                </a>
              ))}
            </div>
          </section>
        );
      })}

      {msg && <div className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</div>}
      {dirty && canEdit && <div className="text-xs text-amber-600">{t("Có thay đổi chưa lưu.")}</div>}
    </div>
  );
}
