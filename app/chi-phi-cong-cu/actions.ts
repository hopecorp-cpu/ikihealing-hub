"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getCosts, saveCosts, type Cost } from "@/lib/platform-costs";

export async function saveCostsAction(edits: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "Không có quyền" };
  try {
    const items = await getCosts();
    const next: Cost[] = items.map((c) => {
      if (!(c.id in edits)) return c;
      if (c.auto) return c;
      const raw = String(edits[c.id] ?? "").trim();
      return { ...c, monthlyVnd: raw === "" ? null : Number(raw.replace(/[^\d.-]/g, "")) || 0 };
    });
    await saveCosts(next);
    revalidatePath("/chi-phi-cong-cu");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
