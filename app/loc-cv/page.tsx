import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { geminiConfigured } from "@/lib/gemini";
import Client from "./Client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Lọc CV bằng AI | IKIHEALING Hub") };
}

export type CvJob = { id: number; title: string; jd_text: string; must_have?: string; nice_have?: string; status?: string; public_token?: string; is_public?: boolean; public_desc?: string };
export type CvScreen = {
  id: number; job_id: number; name: string; email: string; phone: string; score: number; verdict: string;
  strengths: string[]; concerns: string[]; red_flags: string[]; culture_fit: string; summary: string; stage: string; source?: string;
};

export default async function LocCvPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role))) redirect("/");

  const sb = getServiceClient();
  const [jobsRes, screensRes] = await Promise.all([
    sb.from("cv_jobs").select("*").order("created_at", { ascending: false }),
    sb.from("cv_screenings").select("*").order("score", { ascending: false }),
  ]);

  return (
    <Client
      jobs={(jobsRes.data || []) as CvJob[]}
      screens={(screensRes.data || []) as CvScreen[]}
      geminiOn={geminiConfigured()}
    />
  );
}
