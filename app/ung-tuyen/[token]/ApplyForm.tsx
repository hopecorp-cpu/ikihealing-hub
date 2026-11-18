"use client";
import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { applyToJob } from "./actions";
import { Upload, CheckCircle2, FileText } from "lucide-react";

export default function ApplyForm({ token, geminiOn }: { token: string; geminiOn: boolean }) {
  const { t: t } = useLang();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");

  async function onSubmit(fd: FormData) {
    setErr("");
    if (!(fd.get("file") instanceof File) || !(fd.get("file") as File).size) {
      setErr("Vui lòng chọn file CV (PDF).");
      return;
    }
    setBusy(true);
    const r = await applyToJob(token, fd);
    setBusy(false);
    if (r.ok) setDone(true);
    else setErr(r.error || "Có lỗi, thử lại sau.");
  }

  if (done) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h2 className="mt-3 text-lg font-semibold text-emerald-800 dark:text-emerald-300">{t("Đã nhận hồ sơ của bạn")}</h2>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
          {t("Cảm ơn bạn đã ứng tuyển vào ACME Corp. Bộ phận nhân sự sẽ liên hệ nếu hồ sơ phù hợp.")}
        </p>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="mt-6 space-y-4">
      {!geminiOn && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t("Hệ thống đang bảo trì, vui lòng thử lại sau.")}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("Họ và tên")}</label>
          <input name="name" required className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("Số điện thoại")}</label>
          <input name="phone" required inputMode="tel" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input name="email" required type="email" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("CV của bạn (PDF)")}</label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-sm text-neutral-500 dark:border-neutral-700">
          <FileText className="h-4 w-4" />
          {fileName || t("Chọn file PDF (tối đa 8MB)")}
          <input
            name="file"
            type="file"
            accept="application/pdf"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
            className="hidden"
          />
        </label>
      </div>

      <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <label className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <input name="consent" type="checkbox" required className="mt-0.5" />
        <span>
          {t("Tôi đồng ý để ACME Corp lưu trữ và xử lý CV này cho mục đích tuyển dụng, theo quy định bảo vệ dữ liệu cá nhân.")}
        </span>
      </label>

      {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">{err}</div>}

      <button
        disabled={busy || !geminiOn}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        {busy ? t("Đang gửi hồ sơ...") : t("Nộp hồ sơ ứng tuyển")}
      </button>
    </form>
  );
}
