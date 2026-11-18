"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { type ContentPlan } from "@/lib/content-plan";
import { saveContentPlan } from "@/lib/content-plan-server";
import { revalidatePath } from "next/cache";

export async function saveTuyenBai(plan: ContentPlan): Promise<{ ok: boolean; error?: string }> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: me } = await sb.from("users").select("role, position, full_name").eq("id", user.id).maybeSingle();
  if (!me || (!isManagerOrAbove((me as any).role) && !isMktPosition((me as any).position))) {
    return { ok: false, error: "Không đủ quyền" };
  }
  await saveContentPlan(plan, (me as any).full_name || undefined);
  revalidatePath("/tuyen-bai");
  return { ok: true };
}
