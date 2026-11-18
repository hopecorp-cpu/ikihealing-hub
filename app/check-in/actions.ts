"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function getAuthUserId(): Promise<string | null> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  return user?.id ?? null;
}

export async function submitCheckIn(input: { week: number; year: number; q1: string; q2: string; q3: string }) {
  const userId = await getAuthUserId();
  if (!userId) return { success: false, error: "Chưa đăng nhập" };

  const sb = getServiceClient();
  const { error } = await sb.from("checkins").upsert({
    user_id: userId,
    week_number: input.week,
    year: input.year,
    q1_done: input.q1,
    q2_blockers: input.q2,
    q3_next_week: input.q3
  }, { onConflict: "user_id,week_number,year" });

  if (error) return { success: false, error: error.message };
  revalidatePath("/check-in");
  return { success: true };
}

export async function getMyCheckins() {
  const userId = await getAuthUserId();
  if (!userId) return [];

  const sb = getServiceClient();
  const { data } = await sb.from("checkins")
    .select("*, feedbacks(*)")
    .eq("user_id", userId)
    .order("year", { ascending: false })
    .order("week_number", { ascending: false })
    .limit(12);

  return data ?? [];
}
