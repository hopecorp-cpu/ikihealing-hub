"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { runFactory, pushDraftsToCEO } from "@/lib/content-factory";
import { revalidatePath } from "next/cache";

export async function generateDraftsNow(n = 2): Promise<{ ok: boolean; saved?: number; pushed?: number; flagged?: string[]; error?: string }> {

  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: me } = await sb.from("users").select("role, position").eq("id", user.id).maybeSingle();
  if (!me || (!isManagerOrAbove((me as any).role) && !isMktPosition((me as any).position))) {
    return { ok: false, error: "Không đủ quyền" };
  }

  const r = await runFactory(Math.min(6, Math.max(1, n)));
  if (!r.ok) return { ok: false, error: r.error || "AI chưa tạo được bài" };

  const pushed = await pushDraftsToCEO(r.items);
  revalidatePath("/content");
  return { ok: true, saved: r.saved, pushed, flagged: r.flagged };
}
