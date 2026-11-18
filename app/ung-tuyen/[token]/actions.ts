"use server";
import { getServiceClient } from "@/lib/supabase-server";
import { headers } from "next/headers";
import { vuotGioiHan } from "@/lib/chan-spam";
import { screenCvPdf, type JobOpening } from "@/lib/recruiting";

export async function applyToJob(
  token: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {

  if (String(formData.get("company") || "").trim()) return { ok: true };

  const consent = formData.get("consent");
  if (consent !== "on" && consent !== "true") {
    return { ok: false, error: "Cần đồng ý cho phép xử lý CV để nộp hồ sơ." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Thiếu file CV (PDF)." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "File quá lớn (> 8MB)." };

  const buf = Buffer.from(await file.arrayBuffer());

  if (buf.subarray(0, 4).toString("latin1") !== "%PDF") {
    return { ok: false, error: "File không phải PDF hợp lệ." };
  }

  const sb = getServiceClient();
  const { data: job } = await sb
    .from("cv_jobs")
    .select("*")
    .eq("public_token", token)
    .eq("is_public", true)
    .maybeSingle();
  if (!job) return { ok: false, error: "Vị trí này không còn nhận hồ sơ." };

  if (await vuotGioiHan({ headers: headers() }, "ung-tuyen", { moiIpMoiGio: 5, tongMoiNgay: 100 })) return { ok: false, error: "Bạn nộp nhiều quá, thử lại sau ít phút nhé." };

  const s = await screenCvPdf(job as JobOpening, buf.toString("base64"));
  if (!s) return { ok: false, error: "Hệ thống bận, thử lại sau ít phút." };

  const nameTyped = String(formData.get("name") || "").trim();
  const emailTyped = String(formData.get("email") || "").trim();
  const phoneTyped = String(formData.get("phone") || "").trim();

  const { error } = await sb.from("cv_screenings").insert({
    job_id: job.id,
    name: s.name || nameTyped || file.name.replace(/\.pdf$/i, ""),
    email: s.email || emailTyped,
    phone: s.phone || phoneTyped,
    score: s.score,
    verdict: s.verdict,
    strengths: s.strengths,
    concerns: s.concerns,
    red_flags: s.red_flags,
    culture_fit: s.culture_fit,
    summary: s.summary,
    cv_excerpt: s.cv_excerpt,
    source: "form",
    consent: true,
  });
  if (error) return { ok: false, error: "Không lưu được hồ sơ, thử lại sau." };
  return { ok: true };
}
