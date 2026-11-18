"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Video, Plus, Check, X, Sparkles, Search, AlertTriangle, Clock } from "lucide-react";
import { PageHeader, Badge } from "@/components/ui/kit";
import type { VideoItem, LibraryFile } from "@/lib/video-queue";
import { addAction, statusAction, captionAction } from "./actions";

const ST: Record<string, { label: string; cls: string }> = {
  nhap: { label: "Chờ duyệt", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  duyet: { label: "Đã duyệt · chờ máy tải lên", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  da_len_lich: { label: "Facebook đã giữ lịch", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  loi: { label: "Lỗi", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  huy: { label: "Đã huỷ", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

export default function VideoQueueClient({ queue, library, pages, summary, posterStatus }: {
  queue: VideoItem[];
  library: LibraryFile[];
  pages: Array<{ id: string; name: string }>;
  summary: { waiting: number; approved: number; scheduled: number; failed: number; nextDays: Array<{ date: string; count: number }>; gapWarning: string | null };
  posterStatus: { at?: string; ok?: boolean; scheduled?: number; failed?: number } | null;
}) {
  const { t: t } = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [file, setFile] = useState("");
  const [pageId, setPageId] = useState(pages[0]?.id || "");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState("");

  const files = useMemo(() =>
    library.filter((f) => !q.trim() || `${f.name} ${f.folder}`.toLowerCase().includes(q.toLowerCase().trim())).slice(0, 60),
    [library, q]);

  const writeCaption = () => {
    if (!file) { setMsg("Chọn video trước đã"); return; }
    setMsg("");
    start(async () => {
      const r = await captionAction(file.split("/").pop() || "", pageId);
      if (!r.ok) { setMsg(r.error || "Lỗi"); return; }
      setTitle(r.title || ""); setCaption(r.caption || "");
    });
  };

  const submit = () => {
    setMsg("");
    start(async () => {
      const r = await addAction({ file, title, caption, pageId, publishAt: when });
      if (!r.ok) { setMsg(r.error || "Lỗi"); return; }
      setOpen(false); setFile(""); setTitle(""); setCaption(""); setWhen("");
      router.refresh();
    });
  };

  const act = (id: string, status: "duyet" | "huy") =>
    start(async () => { const r = await statusAction(id, status); if (!r.ok) setMsg(r.error || "Lỗi"); router.refresh(); });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <PageHeader
        title={t("Lịch đăng video")}
        subtitle={t("Chọn video, máy viết caption, người duyệt một chạm — Facebook giữ lịch và tự đăng đúng giờ")}
        icon={Video}
        actions={
          <button onClick={() => { setOpen(true); setMsg(""); }} className="text-[12px] px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />{t("Xếp video mới")}
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{t("Chờ duyệt")}</div>
          <div className="text-2xl font-bold text-amber-600 tabular-nums">{summary.waiting}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{t("Đã duyệt, chờ tải lên")}</div>
          <div className="text-2xl font-bold text-sky-700 tabular-nums">{summary.approved}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{t("Facebook đã giữ lịch")}</div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">{summary.scheduled}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{t("Kho video trên máy")}</div>
          <div className="text-2xl font-bold text-gray-800 tabular-nums">{library.length}</div>
        </div>
      </div>

      {summary.gapWarning && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-[13px] text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{summary.gapWarning}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="text-[12px] font-bold text-gray-700 mb-2 inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{t("Bảy ngày tới")}</div>
        <div className="flex gap-2 flex-wrap">
          {summary.nextDays.map((d) => (
            <div key={d.date} className={`px-3 py-1.5 rounded-lg text-[12px] border ${d.count ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
              {d.date.slice(8, 10)}/{d.date.slice(5, 7)} · {d.count} video
            </div>
          ))}
        </div>
        {posterStatus?.at && (
          <div className="text-[11.5px] text-gray-400 mt-2">
            {t("Máy tải lên chạy lần cuối")} {posterStatus.at.slice(0, 16).replace("T", " ")} — {posterStatus.scheduled || 0} {t("video hẹn giờ thành công")}
            {posterStatus.failed ? `, ${posterStatus.failed} lỗi` : ""}.
          </div>
        )}
      </div>

      {msg && <div className="text-[13px] text-rose-600">{msg}</div>}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
        {queue.length === 0 && <div className="p-6 text-center text-[13px] text-gray-400">{t("Hàng đợi trống. Bấm &quot;Xếp video mới&quot; để bắt đầu.")}</div>}
        {queue.map((v) => (
          <div key={v.id} className="p-3 flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13.5px] font-bold text-gray-800">{t(v.title)}</span>
                <span className={`text-[10.5px] px-1.5 py-0.5 rounded border font-semibold ${ST[v.status]?.cls || ""}`}>{t(ST[v.status]?.label) || v.status}</span>
              </div>
              <div className="text-[12px] text-gray-500 mt-0.5">{v.pageName} {t("· đăng")} {v.publishAt} · {v.file.split("/").pop()}</div>
              <div className="text-[12px] text-gray-600 mt-1 line-clamp-2">{t(v.caption)}</div>
              {v.error && <div className="text-[12px] text-rose-600 mt-1">{v.error}</div>}
            </div>
            {v.status === "nhap" && (
              <button onClick={() => act(v.id, "duyet")} disabled={pending}
                className="text-[12px] px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold inline-flex items-center gap-1">
                <Check className="w-3 h-3" />{t("Duyệt đăng")}
              </button>
            )}
            {(v.status === "nhap" || v.status === "duyet" || v.status === "loi") && (
              <button onClick={() => act(v.id, "huy")} disabled={pending} className="text-[12px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500">{t("Huỷ")}</button>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-400">
        {t("Cách chạy: bạn duyệt xong, sáng hôm sau máy trên văn phòng tải video lên Facebook kèm mốc giờ — sau đó Facebook tự đăng đúng giờ,\n        kể cả khi máy tắt. Caption luôn bị soát từ cấm trước khi được duyệt.")}
      </p>

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-2xl space-y-2.5 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-gray-800">{t("Xếp video vào lịch đăng")}</div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Tìm video trong kho...")}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
              {files.map((f) => (
                <button key={f.file} onClick={() => setFile(f.file)}
                  className={`w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-emerald-50 ${file === f.file ? "bg-emerald-50 text-emerald-800 font-semibold" : "text-gray-600"}`}>
                  {f.name} <span className="text-gray-400">· {f.folder} · {f.sizeMb}MB</span>
                </button>
              ))}
              {files.length === 0 && <div className="px-3 py-3 text-[12px] text-gray-400">{t("Không thấy video nào khớp.")}</div>}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11.5px] text-gray-500">Fanpage
                <select value={pageId} onChange={(e) => setPageId(e.target.value)} className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 text-sm">
                  {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="text-[11.5px] text-gray-500">{t("Giờ đăng (giờ Việt Nam)")}
                <input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="2026-08-01 19:30"
                  className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={writeCaption} disabled={pending || !file}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 font-semibold inline-flex items-center gap-1 disabled:opacity-50">
                <Sparkles className="w-3.5 h-3.5" />{pending ? t("Đang viết...") : t("Máy viết caption")}
              </button>
              <span className="text-[11.5px] text-gray-400">{t("Viết xong bạn sửa lại tuỳ ý trước khi lưu.")}</span>
            </div>

            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Tiêu đề video")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} placeholder={t("Caption đăng kèm")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />

            {msg && <div className="text-[12px] text-rose-600">{msg}</div>}
            <button onClick={submit} disabled={pending || !file || !title || !when}
              className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
              {pending ? t("Đang lưu...") : t("Lưu vào hàng đợi (chờ duyệt)")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
