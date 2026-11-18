"use server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { ASSIGN_CONFIG_KEY, CARE_CONFIG_KEY } from "@/lib/sale-suggestions";
import { revalidatePath } from "next/cache";

const saleIdOf = (v: any) => (typeof v === "string" ? v : v?.s) || null;

async function guardOwner(customerId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Chưa đăng nhập" };
  if (isManagerOrAbove(user.role)) return { ok: true as const, user };
  const raw = await getConfigValue(ASSIGN_CONFIG_KEY);
  let map: Record<string, any> = {};
  try { map = raw ? JSON.parse(raw) : {}; } catch {}
  if (saleIdOf(map[customerId]) !== user.id)
    return { ok: false as const, error: "Khách này không thuộc danh sách của bạn" };
  return { ok: true as const, user };
}

export async function setCareStatus(customerId: string, done: boolean, note: string) {
  const g = await guardOwner(customerId);
  if (!g.ok) return { success: false, error: g.error };
  const raw = await getConfigValue(CARE_CONFIG_KEY);
  let map: Record<string, any> = {};
  try { map = raw ? JSON.parse(raw) : {}; } catch {}
  map[customerId] = { done, note: (note || "").slice(0, 500), at: new Date().toISOString() };
  await setConfigValue(CARE_CONFIG_KEY, JSON.stringify(map), "Trạng thái chăm sóc KH (sale)");
  revalidatePath("/sales/khach-cua-toi");
  revalidatePath("/sales/tro-ly");
  return { success: true };
}

export async function updateCustomerField(customerId: string, fields: { full_name?: string; phone?: string }) {
  const g = await guardOwner(customerId);
  if (!g.ok) return { success: false, error: g.error };
  const patch: any = {};
  if (typeof fields.full_name === "string" && fields.full_name.trim()) patch.full_name = fields.full_name.trim();
  if (typeof fields.phone === "string") patch.phone = fields.phone.replace(/[^\d+]/g, "").slice(0, 15);
  if (Object.keys(patch).length === 0) return { success: false, error: "Không có gì để cập nhật" };
  patch.updated_at = new Date().toISOString();
  const sb = getServiceClient();
  const { error } = await sb.from("customers").update(patch).eq("id", customerId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/sales/khach-cua-toi");
  revalidatePath("/sales/tro-ly");
  return { success: true };
}
