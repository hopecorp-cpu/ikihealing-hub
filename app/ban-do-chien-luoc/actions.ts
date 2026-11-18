"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getStrategyOverrides, saveStrategyOverrides } from "@/lib/strategy-map";
import { setConfigValue } from "@/lib/app-config";
import { findBanned, sanitizeContent } from "@/lib/banned-words";
import { revalidatePath } from "next/cache";

export async function saveObjective(key: string, patch: { target?: number; initiative?: string; owner?: string; current?: number }) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "forbidden" };
  const cur = await getStrategyOverrides();
  const clean = (s?: string) => (s && findBanned(s).length ? sanitizeContent(s) : s) || "";
  cur.obj[key] = {
    ...(cur.obj[key] || {}),
    ...(patch.target != null ? { target: patch.target } : {}),
    ...(patch.current != null ? { current: patch.current } : {}),
    ...(patch.initiative != null ? { initiative: clean(patch.initiative) } : {}),
    ...(patch.owner != null ? { owner: clean(patch.owner) } : {}),
  };
  await saveStrategyOverrides(cur.obj, user.email || "");
  revalidatePath("/ban-do-chien-luoc");
  return { ok: true };
}

export async function saveFixedCost(amount: number) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "forbidden" };
  await setConfigValue("monthly_fixed_cost", String(Math.max(0, Math.round(amount))), "Chi phí cố định tháng (BEP)");
  revalidatePath("/ban-do-chien-luoc");
  return { ok: true };
}
