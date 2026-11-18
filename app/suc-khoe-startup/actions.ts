"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { FINANCE_WHITELIST } from "@/lib/auth";
import { setConfigValue } from "@/lib/app-config";
import { revalidatePath } from "next/cache";

const WHITELIST = FINANCE_WHITELIST;

export async function saveCash(amountTrieu: number): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  const email = (user?.email || "").toLowerCase().trim();
  if (!user || !(user.role === "ceo" || WHITELIST.includes(email))) return { ok: false, error: "Không có quyền" };
  await setConfigValue("cash_balance", String(Math.round((amountTrieu || 0) * 1e6)), "Số dư tiền mặt hiện tại (VND) cho runway");
  revalidatePath("/suc-khoe-startup");
  return { ok: true };
}
