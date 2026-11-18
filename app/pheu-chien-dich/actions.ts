"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function guard() {
  const u = await getCurrentUser();
  return !!u && (isManagerOrAbove(u.role) || isMktPosition((u as any).position));
}
async function load(): Promise<any[]> {
  try { return JSON.parse((await getConfigValue("mkt_campaigns")) || "[]"); } catch { return []; }
}
export async function saveCampaign(c: any): Promise<{ ok: boolean; error?: string }> {
  if (!(await guard())) return { ok: false, error: "Không có quyền" };
  if (!c.name || !c.channel || !c.start || !c.end) return { ok: false, error: "Thiếu tên/kênh/thời gian" };
  const list = await load();
  if (c.id) { const i = list.findIndex(x => x.id === c.id); if (i >= 0) list[i] = c; else list.push(c); }
  else { c.id = "c" + Date.now(); list.push(c); }
  await setConfigValue("mkt_campaigns", JSON.stringify(list), "Chiến dịch MKT");
  revalidatePath("/pheu-chien-dich");
  return { ok: true };
}
export async function deleteCampaign(id: string): Promise<{ ok: boolean }> {
  if (!(await guard())) return { ok: false };
  const list = (await load()).filter(x => x.id !== id);
  await setConfigValue("mkt_campaigns", JSON.stringify(list));
  revalidatePath("/pheu-chien-dich");
  return { ok: true };
}
