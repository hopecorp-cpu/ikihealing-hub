import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { getQuizSubmissions, sdtQuiz } from "@/lib/quiz-leads";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { layNhatKyCham, type DongCham } from "@/lib/quiz-cham-soc";
import quizSolutions from "@/data/quiz-solutions.json";
import quizMealPlans from "@/data/quiz-meal-plans.json";
import QuizLeadsClient from "./QuizLeadsClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Khách từ Quiz | ACME Ops Hub") };
}

const PATTERN_VI: Record<string, string> = {
  duong_hu: "Dương hư (thiên hàn)",
  am_hu: "Âm hư (thiên nhiệt)",
  han_thuc: "Hàn thực",
  nhiet_thuc: "Nhiệt thực",
  dam_thap: "Đàm thấp",
  can_bang: "Cân bằng (bình hoà)",
};
const PATTERN_CLS: Record<string, string> = {
  duong_hu: "bg-sky-500", am_hu: "bg-rose-400", han_thuc: "bg-indigo-500",
  nhiet_thuc: "bg-orange-500", dam_thap: "bg-teal-500", can_bang: "bg-emerald-500",
};

async function CoDiaStats({ range, loc }: { range: string; loc: string }) {
  const { t: t } = getT();
  let rows: { ts: number; loc: string; pattern: string }[] = [];
  try { rows = JSON.parse((await getConfigValue("quiz_codia_answers")) || "[]"); } catch { rows = []; }
  const days = range === "all" ? 0 : Number(range) || 30;
  const since = days ? Date.now() - days * 86400_000 : 0;
  const filtered = rows.filter((r) => r.ts >= since && (loc === "all" || r.loc === loc));
  const byPattern: Record<string, number> = {};
  const byLoc: Record<string, number> = {};
  for (const r of filtered) {
    byPattern[r.pattern] = (byPattern[r.pattern] || 0) + 1;
    byLoc[r.loc] = (byLoc[r.loc] || 0) + 1;
  }
  const total = filtered.length;
  const max = Math.max(1, ...Object.values(byPattern));
  const order = Object.keys(PATTERN_VI).filter((p) => byPattern[p]).sort((a, b) => byPattern[b] - byPattern[a]);
  const link = (params: string, label: string, active: boolean) => (
    <a href={`/quiz-leads?${params}`} className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>{label}</a>
  );
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 sm:p-5 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold text-gray-900">{t("Quiz cơ địa Đông y — phân bố thể trạng")}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {t("Ghi ẩn danh mỗi lượt xem kết quả (kể cả không để email) · vi")} {byLoc.vi || 0} · en {byLoc.en || 0} · ja {byLoc.ja || 0}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {link(`d=7&loc=${loc}`, t("7 ngày"), range === "7")}
          {link(`d=30&loc=${loc}`, t("30 ngày"), range === "30")}
          {link(`d=all&loc=${loc}`, t("Tất cả"), range === "all")}
          <span className="w-px bg-gray-200 mx-0.5" />
          {link(`d=${range}&loc=all`, t("Mọi ngôn ngữ"), loc === "all")}
          {link(`d=${range}&loc=vi`, "VI", loc === "vi")}
          {link(`d=${range}&loc=en`, "EN", loc === "en")}
          {link(`d=${range}&loc=ja`, "JA", loc === "ja")}
        </div>
      </div>
      {total === 0 ? (
        <div className="text-sm text-gray-400 mt-4">{t("Chưa có lượt làm nào trong khoảng đã chọn.")}</div>
      ) : (
        <div className="mt-4 space-y-2">
          {order.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <div className="w-44 shrink-0 text-[13px] text-gray-700">{t(PATTERN_VI[p]) || p}</div>
              <div className="flex-1 h-5 bg-gray-50 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${PATTERN_CLS[p] || "bg-gray-400"}`} style={{ width: `${Math.round((byPattern[p] / max) * 100)}%` }} />
              </div>
              <div className="w-20 shrink-0 text-right text-[13px] font-semibold text-gray-900">
                {byPattern[p]} · {Math.round((byPattern[p] / total) * 100)}%
              </div>
            </div>
          ))}
          <div className="text-xs text-gray-400 pt-1">{t("Tổng")} {total} {t("lượt hoàn tất trong khoảng đã chọn.")}</div>
        </div>
      )}
    </div>
  );
}

export default async function QuizLeadsPage({ searchParams }: { searchParams: { d?: string; loc?: string } }) {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const manager = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role);
  const isSale = isSalePosition((user as any).position);
  if (!manager && !isSale) redirect("/");

  const range = ["7", "30", "all"].includes(searchParams.d || "") ? searchParams.d! : "30";
  const loc = ["all", "vi", "en", "ja"].includes(searchParams.loc || "") ? searchParams.loc! : "all";

  const all = await getQuizSubmissions();
  const leads = [...all].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 300);

  const chamSoc: Record<string, { status: string; cham: boolean; sale: string | null; ngay: string | null }> = {};
  const phones = [...new Set(leads.map((l) => sdtQuiz(l.phone)).filter(Boolean))] as string[];
  try {
    if (phones.length) {
      const sb = getServiceClient();
      const { data } = await sb.from("leads").select("phone, status, first_contact_at, assigned_at, assignee_id, users:assignee_id(full_name)").in("phone", phones);
      for (const r of (data || []) as any[]) {
        const cur = chamSoc[r.phone];
        const cham = !!r.first_contact_at || ["contacted", "caring", "won"].includes(r.status);
        if (cur && cur.cham && !cham) continue;
        chamSoc[r.phone] = { status: r.status, cham, sale: r.users?.full_name || null, ngay: r.first_contact_at || r.assigned_at || null };
      }
    }
  } catch {  }

  let nhatKy: Record<string, DongCham[]> = {};
  try {
    if (phones.length) nhatKy = await layNhatKyCham(getServiceClient(), phones);
  } catch { nhatKy = {}; }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">{t("Khách từ Quiz sức khoẻ")}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        {t("Mỗi người làm quiz ở example.com/quiz đổ về đây kèm thể trạng, chỉ số yếu và gói quan tâm — có sẵn giải pháp và tin nhắn tư vấn để bạn copy gửi khách.")}
      </p>
      <CoDiaStats range={range} loc={loc} />
      <QuizLeadsClient
        leads={leads as any}
        chamSoc={chamSoc}
        nhatKy={nhatKy}
        solutions={(quizSolutions as any).profiles}
        guardrails={(quizSolutions as any).guardrails}
        mealPlans={quizMealPlans as any}
      />
    </div>
  );
}
