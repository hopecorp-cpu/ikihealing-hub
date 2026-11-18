"use server";
import { guardManager } from "@/lib/role-guard";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { ASSIGN_CONFIG_KEY, isSalePosition } from "@/lib/sale-suggestions";
import { revalidatePath } from "next/cache";

export async function assignCustomers(customerIds: string[], saleId: string | null) {
  const g = await guardManager();
  if (!g.ok) return { success: false, error: g.error };
  if (!Array.isArray(customerIds) || customerIds.length === 0)
    return { success: false, error: "Chưa chọn khách hàng nào" };

  const raw = await getConfigValue(ASSIGN_CONFIG_KEY);
  let map: Record<string, any> = {};
  try { map = raw ? JSON.parse(raw) : {}; } catch { map = {}; }

  const nowIso = new Date().toISOString();
  let changed = 0;
  for (const cid of customerIds) {
    if (saleId) { map[cid] = { s: saleId, at: nowIso }; changed++; }
    else if (map[cid]) { delete map[cid]; changed++; }
  }
  await setConfigValue(ASSIGN_CONFIG_KEY, JSON.stringify(map), "Phân công KH → sale (Trợ lý Sale)");
  revalidatePath("/sales/tro-ly");
  revalidatePath("/sales/khach-cua-toi");
  return { success: true, changed };
}

export async function autoAssignBalanced(customerIds: string[], saleIds?: string[]) {
  const g = await guardManager();
  if (!g.ok) return { success: false, error: g.error };
  if (!Array.isArray(customerIds) || customerIds.length === 0)
    return { success: false, error: "Chưa chọn khách hàng nào" };

  const sb = getServiceClient();
  const { data: users } = await sb.from("users").select("id, full_name, position, role").eq("active", true);
  const pool = (users || []).filter((u: any) => u.role !== "ceo");

  const sales = (saleIds && saleIds.length > 0)
    ? pool.filter((u: any) => saleIds.includes(u.id))
    : pool.filter((u: any) => isSalePosition(u.position));
  if (sales.length === 0) return { success: false, error: "Chưa chọn sale nào để chia" };

  const raw = await getConfigValue(ASSIGN_CONFIG_KEY);
  let map: Record<string, any> = {};
  try { map = raw ? JSON.parse(raw) : {}; } catch { map = {}; }
  const saleIdOf = (v: any) => (typeof v === "string" ? v : v?.s) || null;

  const load: Record<string, number> = {};
  for (const s of sales) load[s.id] = 0;
  for (const v of Object.values(map)) { const sid = saleIdOf(v); if (sid && sid in load) load[sid]++; }

  const nowIso = new Date().toISOString();
  let assigned = 0, skipped = 0;
  for (const cid of customerIds) {
    if (map[cid]) { skipped++; continue; }

    let best = sales[0].id;
    for (const s of sales) if (load[s.id] < load[best]) best = s.id;
    map[cid] = { s: best, at: nowIso };
    load[best]++; assigned++;
  }

  await setConfigValue(ASSIGN_CONFIG_KEY, JSON.stringify(map), "Phân công KH → sale (Trợ lý Sale)");
  revalidatePath("/sales/tro-ly");
  revalidatePath("/sales/khach-cua-toi");
  return { success: true, assigned, skipped, sales: sales.length };
}
