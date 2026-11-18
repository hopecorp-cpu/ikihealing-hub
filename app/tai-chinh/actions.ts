"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { FINANCE_WHITELIST } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { revalidatePath } from "next/cache";

const WHITELIST = FINANCE_WHITELIST;

export async function saveBalanceSheet(month: string, data: Record<string, number>): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  const email = (user?.email || "").toLowerCase().trim();
  if (!user || !(user.role === "ceo" || WHITELIST.includes(email))) return { ok: false, error: "Không có quyền" };
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "Tháng không hợp lệ" };

  const raw = await getConfigValue("balance_sheet");
  let obj: Record<string, any> = {};
  try { obj = raw ? JSON.parse(raw) : {}; } catch { obj = {}; }
  obj[month] = data;
  await setConfigValue("balance_sheet", JSON.stringify(obj), "Số liệu bảng cân đối kế toán theo tháng (VND)");
  revalidatePath("/tai-chinh");
  return { ok: true };
}
