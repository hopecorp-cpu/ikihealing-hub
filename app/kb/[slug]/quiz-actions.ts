"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { chamBai, maySoanDe, type CauHoi } from "@/lib/kb-quiz";
import { isManagerOrAbove } from "@/lib/auth";

async function nguoiHienTai() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const sb = getServiceClient();
  const { data: u } = await sb.from("users").select("id, role, position, full_name").eq("id", user.id).maybeSingle();
  return u;
}

export async function layDeBai(articleId: string) {
  const u = await nguoiHienTai();
  if (!u) return { ok: false as const, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: quiz } = await sb.from("kb_quizzes").select("id, title, pass_pct, time_limit_s, active").eq("article_id", articleId).maybeSingle();
  if (!quiz || !quiz.active) return { ok: true as const, quiz: null, cauHoi: [], daDat: false, lanLam: 0 };
  const { data: q } = await sb.from("kb_quiz_questions").select("id, question, choices, sort_order").eq("quiz_id", quiz.id).order("sort_order");
  const { data: att } = await sb.from("kb_quiz_attempts").select("passed, score_pct").eq("quiz_id", quiz.id).eq("user_id", u.id).order("created_at", { ascending: false }).limit(50);
  return {
    ok: true as const,
    quiz: { id: quiz.id, title: quiz.title, passPct: quiz.pass_pct, timeLimitS: quiz.time_limit_s },
    cauHoi: (q || []).map((x: any) => ({ id: x.id, question: x.question, choices: x.choices as string[] })),
    daDat: (att || []).some((a: any) => a.passed),
    lanLam: (att || []).length,
    diemCaoNhat: Math.max(0, ...(att || []).map((a: any) => a.score_pct || 0)),
  };
}

export async function nopBai(quizId: string, traLoi: number[], durationS?: number) {
  const u = await nguoiHienTai();
  if (!u) return { ok: false as const, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: quiz } = await sb.from("kb_quizzes").select("id, pass_pct, article_id").eq("id", quizId).maybeSingle();
  if (!quiz) return { ok: false as const, error: "Không có bài kiểm tra này" };
  const { data: q } = await sb.from("kb_quiz_questions").select("id, question, choices, correct_idx, explanation, sort_order").eq("quiz_id", quizId).order("sort_order");
  const cauHoi = (q || []) as CauHoi[];
  const { scorePct, dung } = chamBai(cauHoi, traLoi);
  const passed = scorePct >= (quiz.pass_pct || 80);
  const { error } = await sb.from("kb_quiz_attempts").insert({
    quiz_id: quizId, user_id: u.id, answers: traLoi, score_pct: scorePct, passed, duration_s: durationS ?? null,
  });
  if (error) return { ok: false as const, error: error.message };

  if (passed) {
    await sb.from("kb_read_log").upsert({ user_id: u.id, article_id: quiz.article_id, acknowledged: true }, { onConflict: "user_id,article_id" });
  }
  revalidatePath("/kb");
  return {
    ok: true as const, scorePct, passed, passPct: quiz.pass_pct,
    chiTiet: cauHoi.map((c, i) => ({ dung: dung[i], chon: traLoi[i] ?? -1, dapAn: c.correct_idx, giaiThich: c.explanation || "" })),
  };
}

export async function maySoanDeNhap(articleId: string, soCau = 5) {
  const u = await nguoiHienTai();
  if (!u || !isManagerOrAbove(u.role)) return { ok: false as const, error: "Chỉ quản lý mới soạn đề" };
  const sb = getServiceClient();
  const { data: bai } = await sb.from("kb_articles").select("id, title, content").eq("id", articleId).maybeSingle();
  if (!bai) return { ok: false as const, error: "Không có bài" };
  let cauHoi: CauHoi[] = [];
  try { cauHoi = await maySoanDe(bai.title, bai.content, soCau); }
  catch (e: any) { return { ok: false as const, error: `Máy soạn hỏng: ${String(e?.message || e).slice(0, 120)}` }; }
  if (cauHoi.length < 2) return { ok: false as const, error: `Máy chỉ soạn được ${cauHoi.length} câu dùng được — bài này có thể quá ngắn hoặc toàn danh sách. Viết tay giúp em.` };

  let quizId: string;
  const { data: cu } = await sb.from("kb_quizzes").select("id").eq("article_id", articleId).maybeSingle();
  if (cu) { quizId = cu.id; await sb.from("kb_quiz_questions").delete().eq("quiz_id", quizId); }
  else {
    const { data: moi, error } = await sb.from("kb_quizzes").insert({ article_id: articleId, title: `Kiểm tra: ${bai.title}`.slice(0, 200), pass_pct: 80, active: false, created_by: u.id }).select("id").single();
    if (error || !moi) return { ok: false as const, error: error?.message || "không tạo được" };
    quizId = moi.id;
  }
  const { error: e2 } = await sb.from("kb_quiz_questions").insert(cauHoi.map((c, i) => ({
    quiz_id: quizId, sort_order: i, question: c.question, choices: c.choices, correct_idx: c.correct_idx, explanation: c.explanation || null,
  })));
  if (e2) return { ok: false as const, error: e2.message };
  revalidatePath(`/kb`);
  return { ok: true as const, quizId, soCau: cauHoi.length, cauHoi };
}

export async function catDatQuiz(quizId: string, phan: { active?: boolean; passPct?: number }) {
  const u = await nguoiHienTai();
  if (!u || !isManagerOrAbove(u.role)) return { ok: false as const, error: "Chỉ quản lý" };
  const sb = getServiceClient();
  const upd: any = { updated_at: new Date().toISOString() };
  if (typeof phan.active === "boolean") upd.active = phan.active;
  if (typeof phan.passPct === "number") upd.pass_pct = Math.min(100, Math.max(1, Math.round(phan.passPct)));
  const { error } = await sb.from("kb_quizzes").update(upd).eq("id", quizId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/kb");
  return { ok: true as const };
}

export async function layDeDayDu(articleId: string) {
  const u = await nguoiHienTai();
  if (!u || !isManagerOrAbove(u.role)) return { ok: false as const, error: "Chỉ quản lý" };
  const sb = getServiceClient();
  const { data: quiz } = await sb.from("kb_quizzes").select("id, title, pass_pct, active").eq("article_id", articleId).maybeSingle();
  if (!quiz) return { ok: true as const, quiz: null, cauHoi: [] as CauHoi[] };
  const { data: q } = await sb.from("kb_quiz_questions").select("id, question, choices, correct_idx, explanation, sort_order").eq("quiz_id", quiz.id).order("sort_order");
  return { ok: true as const, quiz, cauHoi: (q || []) as CauHoi[] };
}

export async function suaCau(cauId: string, phan: { question?: string; choices?: string[]; correct_idx?: number; explanation?: string }) {
  const u = await nguoiHienTai();
  if (!u || !isManagerOrAbove(u.role)) return { ok: false as const, error: "Chỉ quản lý" };
  const sb = getServiceClient();
  const { error } = await sb.from("kb_quiz_questions").update(phan).eq("id", cauId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
