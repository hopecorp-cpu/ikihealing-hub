"use server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/auth";
import { setConfigValue } from "@/lib/app-config";
import { DEPT_KPI_TEMPLATES } from "@/lib/dept-comp";
import { revalidatePath } from "next/cache";

async function requireManager() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) throw new Error("Không có quyền — chỉ BOD");
  return getServiceClient();
}

export async function seedKpiTemplate(userId: string, cycleId: string, templateKey: string): Promise<{ ok: boolean; error?: string; added?: number }> {
  try {
    const sb = await requireManager();
    const tpl = DEPT_KPI_TEMPLATES[templateKey];
    if (!tpl) return { ok: false, error: "Không tìm thấy mẫu KPI" };
    const { data: existing } = await sb.from("kpis").select("id").eq("user_id", userId).eq("cycle_id", cycleId);
    if (existing && existing.length > 0) return { ok: false, error: "Người này đã có KPI trong kỳ — xoá/sửa thủ công trước" };
    const rows = tpl.map(t => ({
      user_id: userId, cycle_id: cycleId, title: t.title, metric_unit: t.metric_unit,
      target_value: t.target_value, current_value: null, weight_percent: t.weight_percent, is_lower_better: !!t.isLowerBetter, status: "active",
    }));
    const { error } = await sb.from("kpis").insert(rows);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/co-che-thuong");
    return { ok: true, added: rows.length };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function updateKpi(kpiId: string, patch: { current_value?: number | null; target_value?: number; weight_percent?: number; is_lower_better?: boolean }): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = await requireManager();
    const { error } = await sb.from("kpis").update(patch).eq("id", kpiId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/co-che-thuong");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function deleteKpi(kpiId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = await requireManager();
    const { error } = await sb.from("kpis").delete().eq("id", kpiId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/co-che-thuong");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function setDeptCompActive(on: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireManager();
    await setConfigValue("dept_comp_active", on ? "1" : "0", "Bật áp cơ chế thưởng phòng ban vào lương thật");
    revalidatePath("/co-che-thuong");
    revalidatePath("/bang-luong");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function saveChuyenCan(amount: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireManager();
    await setConfigValue("chuyen_can_amount", String(Math.max(0, Math.round(amount))), "Mức thưởng chuyên cần / tháng (đ)");
    revalidatePath("/co-che-thuong");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}
