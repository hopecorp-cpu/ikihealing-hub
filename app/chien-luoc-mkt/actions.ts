"use server";

import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { runResearch } from "@/lib/content-factory";

export async function runResearchNow(): Promise<{ ok: boolean; chars?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  if (!(isManagerOrAbove(user.role) || isMktPosition((user as any).position))) return { ok: false, error: "Không có quyền" };
  const r = await runResearch();
  if (!r.ok) return { ok: false, error: r.error || "tra cứu lỗi" };
  return { ok: true, chars: r.summary?.length || 0 };
}
