import { requireUser } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { Rocket, CheckCircle2, Circle, Calendar, Award } from "lucide-react";
import Link from "next/link";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { t } = getT();
  const user = await requireUser();
  const sb = getServiceClient();

  const { data: progress } = await sb.from("onboarding_progress")
    .select("*, onboarding_templates(name, total_days), buddy:users!onboarding_progress_buddy_id_fkey(full_name, position)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!progress) {
    const { data: templates } = await sb.from("onboarding_templates").select("*").eq("active", true);
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-8 text-center">
          <Rocket className="w-12 h-12 mx-auto text-brand-600 mb-3" />
          <h1 className="text-xl font-bold">{t("Chưa có lộ trình onboarding")}</h1>
          <p className="text-gray-600 mt-2">{t("Liên hệ admin/HR để được set up kế hoạch 30 ngày phù hợp với vị trí")} <b>{user.position}</b></p>
          {templates && templates.length > 0 && (
            <div className="mt-4 text-left bg-gray-50 p-4 rounded">
              <div className="text-sm font-semibold mb-2">{t("Các lộ trình có sẵn:")}</div>
              <ul className="text-sm space-y-1">
                {templates.map((tpl: any) => <li key={tpl.id}>• {tpl.name} ({tpl.total_days} {t("ngày")})</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  const [{ data: steps }, { data: completions }] = await Promise.all([
    sb.from("onboarding_steps").select("*").eq("template_id", progress.template_id).order("day_number").order("step_order"),
    sb.from("onboarding_step_completion").select("*").eq("progress_id", progress.id)
  ]);

  const completedIds = new Set((completions ?? []).filter((c: any) => c.completed).map((c: any) => c.step_id));
  const startDate = new Date(progress.start_date);
  const today = new Date();
  const daysIn = Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1;

  const byDay: Record<number, any[]> = {};
  (steps ?? []).forEach((s: any) => {
    byDay[s.day_number] = byDay[s.day_number] || [];
    byDay[s.day_number].push(s);
  });

  const totalSteps = (steps ?? []).length;
  const completedSteps = completedIds.size;
  const completePercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-brand-50 to-blue-50 border border-brand-200 rounded-xl p-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="w-6 h-6 text-brand-600" /> {t("Lộ trình Onboarding của bạn")}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              <b>{progress.onboarding_templates?.name}</b> · {t("Ngày")} {daysIn}/{progress.onboarding_templates?.total_days}
            </p>
            {progress.buddy && (
              <div className="mt-2 text-sm">
                {t("Buddy mentor:")} <b>{progress.buddy.full_name}</b> ({progress.buddy.position})
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-brand-700">{completePercent}%</div>
            <div className="text-xs text-gray-500">{completedSteps}/{totalSteps} {t("bước")}</div>
          </div>
        </div>

        <div className="h-3 bg-white rounded-full mt-4 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-500 to-emerald-500" style={{ width: `${completePercent}%` }} />
        </div>
      </div>

      <div className="space-y-4">
        {Object.keys(byDay).map(Number).sort((a, b) => a - b).map(day => {
          const dayDate = new Date(startDate.getTime() + (day - 1) * 86400000);
          const isToday = day === daysIn;
          const isPast = day < daysIn;
          const isFuture = day > daysIn;
          return (
            <div key={day} className={`bg-white border rounded-xl p-5 ${isToday ? "border-brand-400 ring-2 ring-brand-200" : "border-gray-200"} ${isFuture ? "opacity-60" : ""}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">
                  {t("Ngày")} {day}
                  {isToday && <span className="ml-2 text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full">{t("HÔM NAY")}</span>}
                  {isPast && <span className="ml-2 text-xs text-gray-500">{dayDate.toLocaleDateString("vi-VN")}</span>}
                </h3>
                <div className="text-xs text-gray-500">
                  {byDay[day].filter(s => completedIds.has(s.id)).length}/{byDay[day].length} done
                </div>
              </div>

              <div className="space-y-2">
                {byDay[day].map((s: any) => {
  const { t: t } = getT();
                  const done = completedIds.has(s.id);
                  return (
                    <div key={s.id} className={`flex items-start gap-3 p-3 rounded-lg ${done ? "bg-green-50" : "bg-gray-50"}`}>
                      {done ? <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" /> : <Circle className="w-5 h-5 text-gray-400 mt-0.5" />}
                      <div className="flex-1">
                        <div className={`font-semibold text-sm ${done ? "line-through text-gray-500" : ""}`}>{t(s.title)}</div>
                        {t(s.description) && <div className="text-xs text-gray-600 mt-0.5">{t(s.description)}</div>}
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            {s.step_type === "read_article" ? t("Đọc bài") :
                             s.step_type === "watch_video" ? t("Xem video") :
                             s.step_type === "meeting" ? "Meeting" :
                             s.step_type === "task" ? "Task" :
                             s.step_type === "quiz" ? "Quiz" : "Submit"}
                          </span>
                          {s.estimated_minutes && <span className="text-[10px] text-gray-500">⏱ {s.estimated_minutes} {t("phút")}</span>}
                          {s.is_required && <span className="text-[10px] text-red-600 font-bold">{t("* BẮT BUỘC")}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-semibold mb-3">{t("Quick links cho NV mới")}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/kb" className="bg-gray-50 hover:bg-brand-50 p-3 rounded text-center">
            <div className="text-2xl"></div>
            <div className="text-sm font-medium mt-1">Knowledge Base</div>
          </Link>
          <Link href="/playbook" className="bg-gray-50 hover:bg-brand-50 p-3 rounded text-center">
            <div className="text-2xl"></div>
            <div className="text-sm font-medium mt-1">Sales Playbook</div>
          </Link>
          <Link href="/cham-cong" className="bg-gray-50 hover:bg-brand-50 p-3 rounded text-center">
            <div className="text-2xl">⏰</div>
            <div className="text-sm font-medium mt-1">{t("Chấm công")}</div>
          </Link>
          <Link href="/daily-report" className="bg-gray-50 hover:bg-brand-50 p-3 rounded text-center">
            <div className="text-2xl"></div>
            <div className="text-sm font-medium mt-1">Daily Report</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
