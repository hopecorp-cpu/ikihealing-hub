"use server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { FINANCE_WHITELIST } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { revalidatePath } from "next/cache";

const WHITELIST = FINANCE_WHITELIST;
async function guard() { const u = await getCurrentUser(); const e = (u?.email || "").toLowerCase().trim(); return !!u && (u.role === "ceo" || WHITELIST.includes(e)); }

export async function saveContractLink(userId: string, url: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await guard())) return { ok: false, error: "Không có quyền" };
  let obj: Record<string, string> = {};
  try { obj = JSON.parse((await getConfigValue("contract_links")) || "{}"); } catch { }
  if (url) obj[userId] = url; else delete obj[userId];
  await setConfigValue("contract_links", JSON.stringify(obj), "Link Drive hợp đồng theo nhân viên");
  revalidatePath("/hop-dong");
  return { ok: true };
}
export async function saveCccd(userId: string, cccd: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await guard())) return { ok: false, error: "Không có quyền" };
  await getServiceClient().from("users").update({ cccd: cccd || null }).eq("id", userId);
  revalidatePath("/hop-dong");
  return { ok: true };
}
