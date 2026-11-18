"use server";
import { getServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { screenCvPdf, type JobOpening } from "@/lib/recruiting";
import { revalidatePath } from "next/cache";

async function guard() {
  const u = await getCurrentUser();
  if (!u || !(u.role === "admin" || u.role === "ceo" || isManagerOrAbove(u.role))) {
    throw new Error("unauthorized");
  }
  return u;
}

export async function createJob(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const u = await guard();
  const title = String(formData.get("title") || "").trim();
  const jd_text = String(formData.get("jd_text") || "").trim();
  const must_have = String(formData.get("must_have") || "").trim();
  const nice_have = String(formData.get("nice_have") || "").trim();
  const public_desc = String(formData.get("public_desc") || "").trim();
  if (!title || !jd_text) return { ok: false, error: "Thiếu tên vị trí hoặc mô tả công việc" };
  const sb = getServiceClient();
  const { error } = await sb
    .from("cv_jobs")
    .insert({ title, jd_text, must_have, nice_have, public_desc, created_by: u.email || "" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/loc-cv");
  return { ok: true };
}

export async function screenCv(
  jobId: number,
  formData: FormData
): Promise<{ ok: boolean; error?: string; name?: string; score?: number; verdict?: string }> {
  await guard();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Thiếu file CV" };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "File quá lớn (> 8MB)" };
  const sb = getServiceClient();
  const { data: job } = await sb.from("cv_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Không tìm thấy vị trí" };
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const s = await screenCvPdf(job as JobOpening, base64);
  if (!s) return { ok: false, error: "Chấm CV thất bại (Gemini lỗi/thiếu key)" };
  const { error } = await sb.from("cv_screenings").insert({
    job_id: jobId,
    name: s.name || file.name.replace(/\.pdf$/i, ""),
    email: s.email,
    phone: s.phone,
    score: s.score,
    verdict: s.verdict,
    strengths: s.strengths,
    concerns: s.concerns,
    red_flags: s.red_flags,
    culture_fit: s.culture_fit,
    summary: s.summary,
    cv_excerpt: s.cv_excerpt,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/loc-cv");
  return { ok: true, name: s.name || file.name, score: s.score, verdict: s.verdict };
}

export async function togglePublic(
  jobId: number,
  makePublic: boolean
): Promise<{ ok: boolean; error?: string; token?: string; isPublic?: boolean }> {
  await guard();
  const sb = getServiceClient();
  const { data: job } = await sb.from("cv_jobs").select("public_token").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Không tìm thấy vị trí" };
  const token = (job as { public_token?: string }).public_token || crypto.randomUUID().replace(/-/g, "");
  const { error } = await sb
    .from("cv_jobs")
    .update({ public_token: token, is_public: makePublic })
    .eq("id", jobId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/loc-cv");
  return { ok: true, token, isPublic: makePublic };
}

export async function setStage(id: number, stage: string): Promise<{ ok: boolean }> {
  await guard();
  const sb = getServiceClient();
  await sb.from("cv_screenings").update({ stage }).eq("id", id);
  revalidatePath("/loc-cv");
  return { ok: true };
}
