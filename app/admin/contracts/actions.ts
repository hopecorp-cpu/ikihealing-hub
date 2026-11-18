"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) {
    throw new Error("Chỉ admin được tạo hợp đồng");
  }
  return { sb, adminId: user.id };
}

export type ContractType =
  | "thu_viec"
  | "xac_dinh_1_nam"
  | "xac_dinh_2_nam"
  | "khong_xac_dinh"
  | "ctv"
  | "khoan_viec";

export async function createContract(input: {
  user_id: string;
  contract_type: ContractType;
  effective_date: string;
  end_date?: string | null;
  probation_end_date?: string | null;
  position: string;
  department_id?: string | null;
  base_salary: number;
  salary_pct?: number;
  insurance_salary: number;
  bonus_max?: number;
  allowance?: number;
  custom_terms?: any;
  notes?: string;
}) {
  const { sb, adminId } = await requireAdmin();

  const { data: nrData, error: nrErr } = await sb.rpc("generate_contract_number");
  if (nrErr) return { success: false, error: "Không gen được số HĐ: " + nrErr.message };
  const contract_number = nrData as string;

  const { data, error } = await sb.from("employment_contracts").insert({
    contract_number,
    user_id: input.user_id,
    contract_type: input.contract_type,
    effective_date: input.effective_date,
    end_date: input.end_date || null,
    probation_end_date: input.probation_end_date || null,
    position: input.position,
    department_id: input.department_id || null,
    base_salary: input.base_salary,
    salary_pct: input.salary_pct ?? 100,
    insurance_salary: input.insurance_salary,
    bonus_max: input.bonus_max ?? 0,
    allowance: input.allowance ?? 0,
    custom_terms: input.custom_terms ?? null,
    notes: input.notes ?? null,
    status: "pending_signatures",
    created_by: adminId,
  }).select("id, contract_number").maybeSingle();

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/contracts");
  return { success: true, id: data!.id, contract_number: data!.contract_number };
}

export async function updateContract(id: string, patch: {
  contract_type?: ContractType;
  effective_date?: string;
  end_date?: string | null;
  probation_end_date?: string | null;
  position?: string;
  department_id?: string | null;
  base_salary?: number;
  salary_pct?: number;
  insurance_salary?: number;
  bonus_max?: number;
  allowance?: number;
  notes?: string;
  reset_signatures?: boolean;
}) {
  const { sb } = await requireAdmin();

  const { data: current } = await sb.from("employment_contracts")
    .select("status, employee_signed_at, employer_signed_at")
    .eq("id", id).maybeSingle();
  if (!current) return { success: false, error: "Không tìm thấy HĐ" };

  if (current.status === "terminated") {
    return { success: false, error: "HĐ đã chấm dứt, không thể sửa" };
  }

  const updates: any = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "reset_signatures") continue;
    if (v === undefined) continue;
    updates[k] = v;
  }

  const mustResetSignatures =
    patch.reset_signatures ||
    (current.employee_signed_at || current.employer_signed_at) && (
      patch.base_salary !== undefined ||
      patch.contract_type !== undefined ||
      patch.effective_date !== undefined ||
      patch.end_date !== undefined ||
      patch.position !== undefined
    );

  if (mustResetSignatures) {
    updates.employee_signed_at = null;
    updates.employer_signed_at = null;
    updates.employer_signed_by = null;
    updates.status = "pending_signatures";
  }

  const { error } = await sb.from("employment_contracts").update(updates).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/contracts");
  revalidatePath(`/admin/contracts/${id}`);
  return {
    success: true,
    signaturesReset: mustResetSignatures,
  };
}

export async function getContract(id: string) {
  const { sb } = await requireAdmin();
  const { data } = await sb.from("employment_contracts")
    .select(`
      *,
      user:users!employment_contracts_user_id_fkey(id, full_name, email, phone, cccd, cccd_issued_date, cccd_issued_place, dob, address, position),
      department:departments!employment_contracts_department_id_fkey(name),
      employer_signer:users!employment_contracts_employer_signed_by_fkey(full_name, position)
    `)
    .eq("id", id).maybeSingle();
  return data;
}

export async function listContracts(filter?: { status?: string; user_id?: string }) {
  const { sb } = await requireAdmin();
  let q = sb.from("employment_contracts")
    .select(`
      *,
      user:users!employment_contracts_user_id_fkey(full_name, position),
      department:departments!employment_contracts_department_id_fkey(name)
    `)
    .order("created_at", { ascending: false });
  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.user_id) q = q.eq("user_id", filter.user_id);
  const { data } = await q;
  return data ?? [];
}

export async function signContractByEmployer(contractId: string) {
  const { sb, adminId } = await requireAdmin();

  const { data: current } = await sb.from("employment_contracts")
    .select("status, employee_signed_at").eq("id", contractId).maybeSingle();
  if (!current) return { success: false, error: "Không tìm thấy HĐ" };

  const newStatus = current.employee_signed_at ? "active" : "signed_by_employer";

  const { error } = await sb.from("employment_contracts").update({
    employer_signed_at: new Date().toISOString(),
    employer_signed_by: adminId,
    status: newStatus,
    updated_at: new Date().toISOString(),
  }).eq("id", contractId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/contracts");
  revalidatePath(`/admin/contracts/${contractId}`);
  return { success: true };
}

export async function signContractByEmployee(contractId: string) {
  const { sb } = await requireAdmin();
  const { data: current } = await sb.from("employment_contracts")
    .select("status, employer_signed_at").eq("id", contractId).maybeSingle();
  if (!current) return { success: false, error: "Không tìm thấy HĐ" };

  const newStatus = current.employer_signed_at ? "active" : "signed_by_employee";

  const { error } = await sb.from("employment_contracts").update({
    employee_signed_at: new Date().toISOString(),
    status: newStatus,
    updated_at: new Date().toISOString(),
  }).eq("id", contractId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/contracts");
  revalidatePath(`/admin/contracts/${contractId}`);
  return { success: true };
}

export async function terminateContract(contractId: string, reason: string) {
  const { sb } = await requireAdmin();
  if (!reason || reason.length < 5) return { success: false, error: "Cần lý do ≥5 ký tự" };
  const { error } = await sb.from("employment_contracts").update({
    status: "terminated",
    terminated_at: new Date().toISOString().slice(0, 10),
    termination_reason: reason,
    updated_at: new Date().toISOString(),
  }).eq("id", contractId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/contracts");
  return { success: true };
}

export async function getUsersForContractDropdown() {
  const { sb } = await requireAdmin();
  const { data } = await sb.from("users")
    .select("id, full_name, email, position, contract_type, base_salary, insurance_salary, hire_date, department_id, cccd, phone, max_bonus")
    .eq("active", true)
    .order("full_name");
  return data ?? [];
}
