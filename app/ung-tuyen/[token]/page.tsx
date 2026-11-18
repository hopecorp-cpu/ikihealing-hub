import { getT } from "@/lib/i18n-server";
import { getServiceClient } from "@/lib/supabase-server";
import { geminiConfigured } from "@/lib/gemini";
import ApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Ứng tuyển | ACME Corp"), robots: { index: false } };
}

export default async function ApplyPage({ params }: { params: { token: string } }) {
  const { t: t } = getT();
  const sb = getServiceClient();
  const { data: job } = await sb
    .from("cv_jobs")
    .select("id, title, jd_text, public_desc, is_public")
    .eq("public_token", params.token)
    .eq("is_public", true)
    .maybeSingle();

  if (!job) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <h1 className="text-xl font-semibold">{t("Vị trí không còn nhận hồ sơ")}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t("Link tuyển dụng đã đóng hoặc không tồn tại.")}</p>
      </main>
    );
  }

  const desc = (job.public_desc || job.jd_text || "").trim();
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-1 text-sm font-medium text-emerald-600">{t("ACME Corp · Tuyển dụng")}</div>
      <h1 className="text-2xl font-semibold">{t(job.title)}</h1>
      {desc && (
        <div className="mt-4 whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {desc}
        </div>
      )}
      <ApplyForm token={params.token} geminiOn={geminiConfigured()} />
    </main>
  );
}
