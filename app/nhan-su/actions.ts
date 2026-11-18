"use server";

import { getServiceClient, getServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { KHOA_DISC_NHAN_SU } from "@/lib/covan/knowledge_dungnguoi";
import type { Role } from "@/lib/auth";

async function requireAdmin() {
  const auth = getServerClient();
  const { data: { user: authUser } } = await auth.auth.getUser();
  if (!authUser) throw new Error("Chưa đăng nhập");

  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", authUser.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) {
    throw new Error("Không có quyền — chỉ admin/ceo");
  }
  return { sb, adminId: authUser.id };
}

export type NewEmployee = {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  position: string;
  department_id: string | null;
  contract_type: string;
  base_salary: number;
  insurance_salary: number;
  max_bonus: number;
};

export async function createEmployee(input: NewEmployee) {
  const { sb } = await requireAdmin();

  const { data: authData, error: authErr } = await sb.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name }
  });
  if (authErr || !authData.user) {
    return { success: false, error: authErr?.message ?? "Không tạo được auth user" };
  }

  const { error: insErr } = await sb.from("users").upsert({
    id: authData.user.id,
    email: input.email,
    full_name: input.full_name,
    role: input.role,
    position: input.position,
    department_id: input.department_id,
    contract_type: input.contract_type,
    base_salary: input.base_salary,
    insurance_salary: input.insurance_salary,
    max_bonus: input.max_bonus,
    active: true
  });

  if (insErr) return { success: false, error: insErr.message };

  revalidatePath("/nhan-su");
  revalidatePath("/");
  return { success: true, userId: authData.user.id };
}

export async function terminateEmployee(input: {
  userId: string;
  terminatedAt: string;
  reason: string;
}) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("users").update({
    active: false,
    terminated_at: input.terminatedAt,
    termination_reason: input.reason
  }).eq("id", input.userId);
  if (error) return { success: false, error: error.message };

  try { await sb.auth.admin.updateUserById(input.userId, { ban_duration: "876000h" }); } catch {}
  revalidatePath("/nhan-su");
  return { success: true };
}

export async function reactivateEmployee(userId: string) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("users").update({
    active: true,
    terminated_at: null,
    termination_reason: null
  }).eq("id", userId);
  if (error) return { success: false, error: error.message };

  try { await sb.auth.admin.updateUserById(userId, { ban_duration: "none" }); } catch {}
  revalidatePath("/nhan-su");
  return { success: true };
}

export async function updateEmployee(userId: string, patch: {
  full_name?: string;
  email?: string;
  phone?: string;
  position?: string;
  department_id?: string | null;
  role?: Role;
  contract_type?: string;
  work_mode?: "office" | "remote" | "hybrid";
  base_salary?: number;
  insurance_salary?: number;
  hourly_rate?: number;
  max_bonus?: number;
  dependent_count?: number;
  cccd?: string;
  tax_code?: string;
  reason?: string;
}) {
  const { sb, adminId } = await requireAdmin();

  const { data: oldData } = await sb.from("users").select("*").eq("id", userId).maybeSingle();
  if (!oldData) return { success: false, error: "Không tìm thấy NV" };

  const updates: any = {};
  const trackedFields = ["base_salary", "insurance_salary", "hourly_rate", "max_bonus", "position", "role", "contract_type", "work_mode"];
  const historyRows: any[] = [];

  for (const [key, val] of Object.entries(patch)) {
    if (key === "reason") continue;
    if (val === undefined) continue;
    updates[key] = val;

    if (trackedFields.includes(key) && String(oldData[key]) !== String(val)) {
      historyRows.push({
        user_id: userId,
        changed_by: adminId,
        field: key,
        old_value: String(oldData[key] ?? ""),
        new_value: String(val ?? ""),
        reason: patch.reason || null
      });
    }
  }

  if (updates.email && updates.email !== oldData.email) {
    const { error: authErr } = await sb.auth.admin.updateUserById(userId, { email: updates.email });
    if (authErr) return { success: false, error: "Lỗi đổi email: " + authErr.message };
  }

  const { error } = await sb.from("users").update(updates).eq("id", userId);
  if (error) return { success: false, error: error.message };

  if (historyRows.length > 0) {
    await sb.from("salary_history").insert(historyRows);
  }

  revalidatePath("/nhan-su");
  revalidatePath("/");
  return { success: true, changesTracked: historyRows.length };
}

export async function adminResetPassword(userId: string, newPassword: string) {
  const { sb } = await requireAdmin();
  if (newPassword.length < 6) return { success: false, error: "Mật khẩu phải ≥6 ký tự" };

  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getSalaryHistory(userId: string) {
  const { sb } = await requireAdmin();
  const { data } = await sb.from("salary_history")
    .select("*, users!salary_history_changed_by_fkey(full_name)")
    .eq("user_id", userId)
    .order("changed_at", { ascending: false });
  return data ?? [];
}

const KHOA_DISC = KHOA_DISC_NHAN_SU;

export async function luuNhomTinhCach(userId: string, nhom: "D" | "I" | "S" | "C" | "") {
  const { sb } = await requireAdmin();
  if (!userId) throw new Error("Thiếu userId");
  const { data } = await sb.from("config").select("value").eq("key", KHOA_DISC).maybeSingle();
  let map: Record<string, string> = {};
  try { map = JSON.parse(data?.value || "{}"); } catch {  }
  if (nhom) map[userId] = nhom; else delete map[userId];
  const { error } = await sb.from("config").upsert({ key: KHOA_DISC, value: JSON.stringify(map) }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidatePath("/nhan-su");
  return { ok: true };
}
