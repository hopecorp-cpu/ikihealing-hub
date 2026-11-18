"use client";
import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJob, screenCv, setStage, togglePublic } from "./actions";
import type { CvJob, CvScreen } from "./page";
import { Briefcase, Plus, Upload, Star, AlertTriangle, ChevronDown, ChevronRight, FileText, Link2, Copy, Check } from "lucide-react";

const STAGES = ["new", "shortlist", "interview", "offer", "reject"];
const STAGE_LABEL: Record<string, string> = {
  new: "Mới", shortlist: "Lọt vòng", interview: "Phỏng vấn", offer: "Offer", reject: "Loại",
};
function scoreColor(s: number): string {
  if (s >= 85) return "bg-emerald-500";
  if (s >= 70) return "bg-teal-500";
  if (s >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export default function Client({ jobs, screens, geminiOn }: { jobs: CvJob[]; screens: CvScreen[]; geminiOn: boolean }) {
  const { t: t } = useLang();
  const router = useRouter();
  const [selId, setSelId] = useState<number | null>(jobs[0]?.id ?? null);
  const [showNew, setShowNew] = useState(jobs.length === 0);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ name: string; status: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const selJob = jobs.find((j) => j.id === selId) || null;
  const applyUrl = selJob?.public_token
    ? (typeof window !== "undefined" ? window.location.origin : "") + "/ung-tuyen/" + selJob.public_token
    : "";

  async function onTogglePublic() {
    if (!selJob) return;
    setSharing(true);
    const r = await togglePublic(selJob.id, !selJob.is_public);
    setSharing(false);
    if (!r.ok) { alert(r.error || "Lỗi"); return; }
    router.refresh();
  }

  function copyLink() {
    if (!applyUrl) return;
    navigator.clipboard?.writeText(applyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  const jobScreens = screens.filter((s) => s.job_id === selId);

  async function onCreate(fd: FormData) {
    setCreating(true);
    const r = await createJob(fd);
    setCreating(false);
    if (!r.ok) { alert(r.error || "Lỗi tạo vị trí"); return; }
    setShowNew(false);
    router.refresh();
  }

  async function runScreen() {
    if (!selJob || !files.length) return;
    setBusy(true);
    setProgress(files.map((f) => ({ name: f.name, status: "chờ..." })));
    for (let i = 0; i < files.length; i++) {
      setProgress((p) => p.map((x, j) => (j === i ? { ...x, status: "đang chấm..." } : x)));
      try {
        const fd = new FormData();
        fd.append("file", files[i]);
        const r = await screenCv(selJob.id, fd);
        setProgress((p) => p.map((x, j) => (j === i ? { ...x, status: r.ok ? `xong · ${r.score} điểm` : `lỗi: ${r.error}` } : x)));
      } catch {
        setProgress((p) => p.map((x, j) => (j === i ? { ...x, status: "lỗi hệ thống" } : x)));
      }
    }
    setBusy(false);
    setFiles([]);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5 flex items-center gap-3">
        <FileText className="h-7 w-7 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-semibold">{t("Lọc CV bằng AI")}</h1>
          <p className="text-sm text-neutral-500">{t("Tạo vị trí + mô tả → tải CV (PDF) → AI chấm điểm phù hợp và xếp hạng.")}</p>
        </div>
      </div>

      {!geminiOn && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t("Chưa cấu hình GEMINI_API_KEY trên Vercel — chưa chấm CV được. Cắm key rồi thử lại.")}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {jobs.map((j) => (
          <button
            key={j.id}
            onClick={() => setSelId(j.id)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              selId === j.id
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                : "border-neutral-200 text-neutral-600 dark:border-neutral-700"
            }`}
          >
            <Briefcase className="mr-1 inline h-3.5 w-3.5" />
            {t(j.title)}
          </button>
        ))}
        <button
          onClick={() => setShowNew((v) => !v)}
          className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 dark:border-neutral-700"
        >
          <Plus className="mr-1 inline h-3.5 w-3.5" /> {t("Vị trí mới")}
        </button>
      </div>

      {showNew && (
        <form action={onCreate} className="mb-6 space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <input name="title" required placeholder={t("Tên vị trí (VD: Nhân viên Sale)")} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
          <textarea name="jd_text" required rows={4} placeholder={t("Mô tả công việc + yêu cầu (JD)")} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
          <input name="must_have" placeholder={t("Bắt buộc phải có (VD: 1 năm sale, giao tiếp tốt)")} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
          <input name="nice_have" placeholder={t("Ưu tiên (VD: từng bán TPCN/mỹ phẩm)")} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
          <textarea name="public_desc" rows={3} placeholder={t("Mô tả hiển thị cho ứng viên xem trên form công khai (để trống = dùng JD ở trên). Nên viết hấp dẫn, KHÔNG lộ tiêu chí chấm nội bộ.")} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
          <button disabled={creating} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {creating ? t("Đang tạo...") : t("Tạo vị trí")}
          </button>
        </form>
      )}

      {selJob && (
        <>
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <Link2 className="h-4 w-4" /> {t("Link ứng tuyển công khai")}
            </div>
            <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
              {t("Bật link rồi đăng lên fanpage/tin tuyển dụng. Ứng viên tự nộp CV (có đồng ý) → tự chấm vào đây. Không cào dữ liệu, đúng luật.")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={onTogglePublic}
                disabled={sharing}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                  selJob.is_public ? "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200" : "bg-emerald-600 text-white"
                }`}
              >
                {sharing ? "..." : selJob.is_public ? t("Đang mở · Tắt link") : t("Bật link công khai")}
              </button>
              {selJob.is_public && applyUrl && (
                <>
                  <input readOnly value={applyUrl} className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300" />
                  <button onClick={copyLink} className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700">
                    {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> {t("Đã chép")}</> : <><Copy className="h-3.5 w-3.5" /> {t("Chép link")}</>}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="mb-2 text-sm font-medium">{t("Tải CV cho:")} {t(selJob.title)}</div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="text-sm"
              />
              <button
                onClick={runScreen}
                disabled={busy || !files.length || !geminiOn}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Upload className="mr-1 inline h-4 w-4" />
                {busy ? t("Đang chấm...") : `Chấm ${files.length || ""} CV`}
              </button>
            </div>
            {progress.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-neutral-500">
                {progress.map((p, i) => (
                  <li key={i}>{p.name} — {p.status}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-neutral-500">{jobScreens.length} {t("ứng viên (xếp theo điểm)")}</div>
            {jobScreens.map((c) => (
              <div key={c.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-3 p-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${scoreColor(c.score)}`}>
                    {c.score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name || t("(không rõ tên)")}</span>
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{c.verdict}</span>
                      {c.source === "form" && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">{t("tự nộp")}</span>
                      )}
                      {c.red_flags?.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-rose-600"><AlertTriangle className="h-3 w-3" />{c.red_flags.length}</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-neutral-500">{c.summary}</div>
                  </div>
                  <select
                    value={t(c.stage)}
                    onChange={(e) => { setStage(c.id, e.target.value).then(() => router.refresh()); }}
                    className="shrink-0 rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                  >
                    {STAGES.map((s) => <option key={s} value={s}>{t(STAGE_LABEL[s])}</option>)}
                  </select>
                  <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="shrink-0 text-neutral-400">
                    {expanded === c.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                </div>
                {expanded === c.id && (
                  <div className="space-y-3 border-t border-neutral-100 p-3 text-sm dark:border-neutral-800">
                    {(c.email || c.phone) && <div className="text-xs text-neutral-500">{[c.email, c.phone].filter(Boolean).join(" · ")}</div>}
                    {c.strengths?.length > 0 && (
                      <div><div className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-600"><Star className="h-3.5 w-3.5" /> {t("Điểm mạnh")}</div><ul className="list-disc pl-5 text-neutral-700 dark:text-neutral-300">{c.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                    )}
                    {c.concerns?.length > 0 && (
                      <div><div className="mb-1 text-xs font-semibold text-amber-600">{t("Điểm cần lưu ý")}</div><ul className="list-disc pl-5 text-neutral-700 dark:text-neutral-300">{c.concerns.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                    )}
                    {c.red_flags?.length > 0 && (
                      <div><div className="mb-1 text-xs font-semibold text-rose-600">{t("Cờ đỏ")}</div><ul className="list-disc pl-5 text-rose-700 dark:text-rose-400">{c.red_flags.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                    )}
                    {c.culture_fit && <div className="text-neutral-600 dark:text-neutral-400"><b>{t("Hợp văn hóa:")}</b> {c.culture_fit}</div>}
                  </div>
                )}
              </div>
            ))}
            {jobScreens.length === 0 && <div className="py-6 text-center text-sm text-neutral-400">{t("Chưa có CV nào cho vị trí này. Tải CV lên để AI chấm.")}</div>}
          </div>
        </>
      )}
    </div>
  );
}
