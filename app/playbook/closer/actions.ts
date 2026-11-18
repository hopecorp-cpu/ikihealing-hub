"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { findBanned, sanitizeContent } from "@/lib/banned-words";
import { revalidatePath } from "next/cache";

export type CloserStory = { who: string; before: string; after: string };
export type CloserCustom = { stories: CloserStory[]; gift: string; updatedAt?: string; updatedBy?: string };

export async function getCloserCustom(): Promise<CloserCustom> {
  try { const d = JSON.parse((await getConfigValue("closer_custom")) || "{}"); return { stories: d.stories || [], gift: d.gift || "", updatedAt: d.updatedAt, updatedBy: d.updatedBy }; }
  catch { return { stories: [], gift: "" }; }
}

export async function saveCloserCustom(input: { stories: CloserStory[]; gift: string }) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "forbidden" };
  const clean = (s: string) => (s && findBanned(s).length ? sanitizeContent(s) : s) || "";
  const stories = (input.stories || [])
    .map((s) => ({ who: clean(s.who || ""), before: clean(s.before || ""), after: clean(s.after || "") }))
    .filter((s) => s.who || s.before || s.after)
    .slice(0, 6);
  await setConfigValue("closer_custom", JSON.stringify({ stories, gift: clean(input.gift || ""), updatedAt: new Date().toISOString(), updatedBy: user.email || "" }), "CLOSER — case khách & quà thật");
  revalidatePath("/playbook/closer");
  return { ok: true };
}
