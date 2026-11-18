"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { generateMonthPlan, getMonthPlan } from "@/lib/campaign-calendar";
import { runCampaign } from "@/lib/dispatch";
import { revalidatePath } from "next/cache";

async function guard(): Promise<{ ok: boolean; error?: string }> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: me } = await sb.from("users").select("role, position").eq("id", user.id).maybeSingle();
  if (!me || (!isManagerOrAbove((me as any).role) && !isMktPosition((me as any).position))) return { ok: false, error: "Không đủ quyền" };
  return { ok: true };
}

export async function generateAction(month: string, postsPerWeek?: number): Promise<{ ok: boolean; error?: string }> {
  const g = await guard(); if (!g.ok) return g;
  try { await generateMonthPlan(month, { postsPerWeek }); revalidatePath("/lich-chien-dich"); return { ok: true }; }
  catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function runEventAction(name: string, hook: string): Promise<{ ok: boolean; passed?: number; failed?: number; error?: string }> {
  const g = await guard(); if (!g.ok) return g as any;
  const r = await runCampaign({
    campaign: name, goal: `${hook} (Nhắc: ưu đãi = TẶNG QUÀ, KHÔNG chiết khấu %.)`,
    channel: "Facebook", funnel: "BOFU", nContent: 3,
  });
  return r;
}

export async function runWeekAction(month: string, week: number): Promise<{ ok: boolean; passed?: number; failed?: number; error?: string }> {
  const g = await guard(); if (!g.ok) return g as any;
  const plan = await getMonthPlan(month);
  const w = plan?.weeks.find((x) => x.week === week);
  if (!w) return { ok: false, error: "Không thấy tuần này (sinh lịch trước đã)" };
  const r = await runCampaign({
    campaign: `Tuần ${week}/${month}`, goal: `${w.theme} — bám lịch chiến dịch tháng`,
    channel: "Facebook", funnel: w.funnel, nContent: w.postsPlanned || 3,
  });
  revalidatePath("/lich-chien-dich");
  return r;
}
