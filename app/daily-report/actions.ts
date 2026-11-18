"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function getUserId() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  return user?.id ?? null;
}

export async function submitDailyReport(input: {
  report_date: string;
  yesterday_done: string;
  today_plan: string;
  blockers?: string;
  mood: "great" | "good" | "ok" | "tired" | "stressed";
  energy_level: number;
  customer_interactions?: number;
  calls_made?: number;
  orders_closed?: number;
  revenue_today?: number;
  hours_worked?: number;
  highlights?: string;
  learnings?: string;
  fields?: Record<string, any>;
}) {
  const userId = await getUserId();
  if (!userId) return { success: false, error: "Chưa đăng nhập" };
  if (!input.yesterday_done.trim() || !input.today_plan.trim())
    return { success: false, error: "Cần điền 'Hôm nay làm được gì' + 'Ngày mai plan gì'" };

  const sb = getServiceClient();
  const { error } = await sb.from("daily_reports").upsert({
    user_id: userId,
    report_date: input.report_date,
    yesterday_done: input.yesterday_done,
    today_plan: input.today_plan,
    blockers: input.blockers,
    mood: input.mood,
    energy_level: input.energy_level,
    customer_interactions: input.customer_interactions || 0,
    calls_made: input.calls_made || 0,
    orders_closed: input.orders_closed || 0,
    revenue_today: input.revenue_today || 0,
    hours_worked: input.hours_worked,
    highlights: input.highlights,
    learnings: input.learnings,
    fields: input.fields || {},
    status: "submitted",
    submitted_at: new Date().toISOString()
  }, { onConflict: "user_id,report_date" });
  if (error) return { success: false, error: error.message };
  revalidatePath("/daily-report");
  return { success: true };
}

export async function reviewDailyReport(reportId: string, comment: string) {
  const userId = await getUserId();
  if (!userId) return { success: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: me } = await sb.from("users").select("role").eq("id", userId).maybeSingle();
  if (!me || !["admin","ceo","manager"].includes(me.role)) return { success: false, error: "Không có quyền" };

  const { error } = await sb.from("daily_reports").update({
    manager_comment: comment,
    manager_seen: true,
    status: "reviewed",
    reviewed_at: new Date().toISOString()
  }).eq("id", reportId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/daily-report");
  return { success: true };
}
