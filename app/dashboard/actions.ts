"use server";
import { guardAdmin } from "@/lib/role-guard";
import { setConfigValue } from "@/lib/app-config";
import { CONFIG_KEY_ANNUAL_TARGET } from "@/lib/bi-targets";
import { revalidatePath } from "next/cache";

export async function updateAnnualTarget(value: number) {
  const g = await guardAdmin();
  if (!g.ok) return { success: false, error: g.error };
  if (!Number.isFinite(value) || value < 1_000_000_000 || value > 1_000_000_000_000) {
    return { success: false, error: "Mục tiêu phải trong khoảng 1 tỷ – 1.000 tỷ" };
  }
  await setConfigValue(CONFIG_KEY_ANNUAL_TARGET, String(Math.round(value)), "Mục tiêu doanh thu cả năm 2026");
  revalidatePath("/dashboard");
  return { success: true };
}
