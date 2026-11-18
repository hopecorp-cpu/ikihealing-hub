"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { saveSop, deleteSop, type SopItem } from "@/lib/sop";
import { findBanned, sanitizeContent } from "@/lib/banned-words";
import { revalidatePath } from "next/cache";

const clean = (s: string) => (s && findBanned(s).length ? sanitizeContent(s) : s) || "";

export async function upsertSop(item: SopItem) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "forbidden" };
  const key = item.key || "sop-" + clean(item.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + "-" + Math.random().toString(36).slice(2, 6);
  await saveSop({
    key,
    title: clean(item.title),
    dept: clean(item.dept),
    icon: item.icon || "",
    purpose: clean(item.purpose),
    steps: (item.steps || []).map(clean).filter(Boolean),
    link: item.link,
    published: item.published !== false,
  }, user.email || "");
  revalidatePath("/quy-trinh");
  revalidatePath("/ban-do-chien-luoc");
  return { ok: true };
}

export async function removeSop(key: string) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "forbidden" };
  await deleteSop(key, user.email || "");
  revalidatePath("/quy-trinh");
  revalidatePath("/ban-do-chien-luoc");
  return { ok: true };
}
