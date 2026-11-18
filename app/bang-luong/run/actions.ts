"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { xemTruocLuongThang, dungDongLuong } from "@/lib/luong-thang";
import { calcPayroll } from "@/lib/payroll";
import { revalidatePath } from "next/cache";

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

export async function previewMonthlyCalc(month: string) {
  const { sb } = await requireAdmin();
  return xemTruocLuongThang(sb, month);
}

export async function commitMonthlyPayroll(input: {
  month: string;
  overrides: Record<string, { bonus_override?: number; reason: string }>;
  manualEdits?: Record<string, { fields: Record<string, number>; reason: string }>;
}) {
  const { sb, adminId } = await requireAdmin();

  const preview = await previewMonthlyCalc(input.month);

  const { data: run } = await sb.from("bonus_calc_runs").insert({
    month: input.month,
    triggered_by: adminId,
    status: "committed",
    total_revenue: preview.teamTotalRevenue,
    total_bonus: preview.totalBonus,
    total_payroll_cost: preview.totalPayrollCost,
    users_count: preview.preview.length,
    team_bonus_triggered: preview.teamBonusTriggered,
    committed_at: new Date().toISOString()
  }).select("id").single();

  const { data: daTru } = await sb.from("payroll")
    .select("user_id, advance_payment, deduction_penalty").eq("month", input.month);
  const truTay: Record<string, { advance: number; penalty: number }> = {};
  (daTru ?? []).forEach((x: any) => {
    truTay[x.user_id] = { advance: x.advance_payment || 0, penalty: x.deduction_penalty || 0 };
  });

  const rows = preview.preview.map(c => {
    const override = input.overrides[c.user_id];
    const finalBonus = override?.bonus_override !== undefined ? override.bonus_override : c.auto_total_bonus;
    return dungDongLuong(c, {
      month: input.month, finalBonus,
      bonusOverride: override?.bonus_override !== undefined ? override.bonus_override : null,
      truTay: truTay[c.user_id],
      livestreamColsReady: preview.livestreamColsReady, hourlyColsReady: preview.hourlyColsReady,
      runId: run?.id ?? null, teamTotalRevenue: preview.teamTotalRevenue, teamBonusTriggered: preview.teamBonusTriggered,
      manualEdit: input.manualEdits?.[c.user_id] || null,
    });
  });

  const { error } = await sb.from("payroll").upsert(rows as any, { onConflict: "user_id,month" });
  if (error) return { success: false, error: error.message };

  for (const [userId, ovr] of Object.entries(input.overrides)) {
    if (ovr.bonus_override === undefined) continue;
    const { data: p } = await sb.from("payroll").select("id").eq("user_id", userId).eq("month", input.month).maybeSingle();
    if (p) {
      const calc = preview.preview.find(c => c.user_id === userId);
      await sb.from("payroll_edits").insert({
        payroll_id: p.id,
        user_id: userId,
        edited_by: adminId,
        field: "bonus_override",
        old_value: calc?.auto_total_bonus || 0,
        new_value: ovr.bonus_override,
        delta: (ovr.bonus_override) - (calc?.auto_total_bonus || 0),
        reason: ovr.reason
      });
    }
  }

  for (const [userId, me] of Object.entries(input.manualEdits || {})) {
    if (!me?.fields) continue;
    const { data: p } = await sb.from("payroll").select("id").eq("user_id", userId).eq("month", input.month).maybeSingle();
    if (!p) continue;
    for (const [field, val] of Object.entries(me.fields)) {
      if (val === undefined || val === null) continue;
      await sb.from("payroll_edits").insert({
        payroll_id: p.id,
        user_id: userId,
        edited_by: adminId,
        field,
        old_value: 0,
        new_value: Math.round(Number(val) || 0),
        delta: 0,
        reason: `[sửa tay trên preview] ${me.reason}`
      });
    }
  }

  revalidatePath("/bang-luong");
  revalidatePath("/phieu-luong");
  return { success: true, runId: run?.id, rowsInserted: rows.length };
}

export async function approveMonthlyPayroll(month: string) {
  const { sb, adminId } = await requireAdmin();
  const { data, error } = await sb.from("payroll")
    .update({ status: "approved", approved_by: adminId })
    .eq("month", month).in("status", ["preview", "draft"])
    .select("id");
  if (error) return { success: false, error: error.message };
  revalidatePath("/bang-luong");
  revalidatePath("/phieu-luong");
  return { success: true, approved: data?.length ?? 0 };
}

export async function unapproveMonthlyPayroll(month: string) {
  const { sb } = await requireAdmin();
  const { data, error } = await sb.from("payroll")
    .update({ status: "draft" })
    .eq("month", month).eq("status", "approved")
    .select("id");
  if (error) return { success: false, error: error.message };
  revalidatePath("/bang-luong");
  revalidatePath("/phieu-luong");
  return { success: true, reopened: data?.length ?? 0 };
}

export async function approveOnePayroll(payrollId: string) {
  const { sb, adminId } = await requireAdmin();
  const { error } = await sb.from("payroll").update({ status: "approved", approved_by: adminId }).eq("id", payrollId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/bang-luong"); revalidatePath("/phieu-luong");
  return { success: true };
}
export async function unapproveOnePayroll(payrollId: string) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("payroll").update({ status: "draft" }).eq("id", payrollId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/bang-luong"); revalidatePath("/phieu-luong");
  return { success: true };
}

export async function markPaidPayroll(payrollId: string) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("payroll").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", payrollId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/bang-luong"); revalidatePath("/phieu-luong");
  return { success: true };
}

export async function unmarkPaidPayroll(payrollId: string) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("payroll").update({ status: "approved", paid_at: null }).eq("id", payrollId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/bang-luong"); revalidatePath("/phieu-luong");
  return { success: true };
}

export async function adminAdjustPayroll(input: {
  payroll_id: string;
  field: string;
  new_value: number;
  reason: string;
}) {
  const { sb, adminId } = await requireAdmin();
  if (!input.reason || input.reason.length < 5) return { success: false, error: "Cần lý do ≥5 ký tự" };

  const { data: row } = await sb.from("payroll").select("*").eq("id", input.payroll_id).maybeSingle();
  if (!row) return { success: false, error: "Không tìm thấy" };
  const oldValue = row[input.field];

  const { error } = await sb.from("payroll").update({ [input.field]: input.new_value }).eq("id", input.payroll_id);
  if (error) return { success: false, error: error.message };

  await sb.from("payroll_edits").insert({
    payroll_id: input.payroll_id,
    user_id: row.user_id,
    edited_by: adminId,
    field: input.field,
    old_value: oldValue || 0,
    new_value: input.new_value,
    delta: input.new_value - (oldValue || 0),
    reason: input.reason
  });

  revalidatePath("/bang-luong");
  return { success: true };
}

const PAYROLL_EDITABLE_NUM = [
  "gross_salary", "bonus_amount", "working_days_actual", "working_days_standard", "salary_by_workdays",
  "total_income",
  "allowance_phone", "allowance_attendance", "allowance_lunch", "allowance_fuel",
  "employee_insurance", "employer_insurance",
  "personal_deduction", "dependent_count", "dependent_deduction", "taxable_income",
  "personal_income_tax", "advance_payment", "deduction_penalty", "net_salary", "total_company_cost",
];
const PAYROLL_EDITABLE_TXT = ["status", "note"];

export async function editPayrollRow(input: {
  payroll_id: string;
  mode?: "auto" | "manual";
  fields?: Record<string, any>;
  gross_salary?: number;
  bonus_amount?: number;
  dependent_count?: number;
  advance_payment?: number;

  deduction_penalty?: number;
  working_days_actual?: number;
  working_days_standard?: number;
  net_override?: number | null;
  note?: string;
  reason: string;
}) {
  const { sb, adminId } = await requireAdmin();
  if (!input.reason || input.reason.trim().length < 5) return { success: false, error: "Cần lý do sửa ≥5 ký tự" };

  const { data: row } = await sb.from("payroll")
    .select("*, users:user_id(contract_type, insurance_salary, dependent_count)")
    .eq("id", input.payroll_id).maybeSingle();
  if (!row) return { success: false, error: "Không tìm thấy dòng lương" };

  if (input.mode === "manual") {
    const patch: any = {};
    for (const k of PAYROLL_EDITABLE_NUM) if (input.fields && k in input.fields) patch[k] = Math.round(Number(input.fields[k]) || 0);
    for (const k of PAYROLL_EDITABLE_TXT) if (input.fields && k in input.fields) patch[k] = String(input.fields[k] ?? "").slice(0, 500);
    if (Object.keys(patch).length === 0) return { success: false, error: "Không có cột nào để sửa" };
    const { error } = await sb.from("payroll").update(patch).eq("id", input.payroll_id);
    if (error) return { success: false, error: error.message };
    const logs: any[] = [];
    for (const k of Object.keys(patch)) {
      if (PAYROLL_EDITABLE_TXT.includes(k)) continue;
      if ((patch[k] ?? 0) !== (row[k] ?? 0))
        logs.push({ payroll_id: input.payroll_id, user_id: row.user_id, edited_by: adminId, field: k, old_value: row[k] || 0, new_value: patch[k], delta: (patch[k] || 0) - (row[k] || 0), reason: input.reason });
    }
    if (logs.length) await sb.from("payroll_edits").insert(logs);
    revalidatePath("/bang-luong");
    return { success: true, net: patch.net_salary ?? row.net_salary, tax: patch.personal_income_tax ?? row.personal_income_tax };
  }

  const n = (v: any, d: number) => (v === undefined || v === null || v === "" ? d : Number(v));
  const gross = n(input.gross_salary, row.gross_salary || 0);
  const bonus = n(input.bonus_amount, row.bonus_amount || 0);
  const dep = n(input.dependent_count, row.dependent_count ?? row.users?.dependent_count ?? 0);
  const advance = n(input.advance_payment, row.advance_payment || 0);
  const penalty = n(input.deduction_penalty, row.deduction_penalty || 0);
  const wdA = n(input.working_days_actual, row.working_days_actual || 26);
  const wdS = n(input.working_days_standard, row.working_days_standard || 26);
  const contract = row.users?.contract_type || "Chính thức";
  const isTrial = contract === "Thử việc";
  const isCTV = /CTV|Part-time|Khoán|Dịch Vụ|Dịch vụ/i.test(contract);
  const insuranceSalary = row.users?.insurance_salary || gross;

  const allowanceTotal =
    (row.allowance_phone || 0) + (row.allowance_attendance || 0) +
    (row.allowance_lunch || 0) + (row.allowance_fuel || 0) + (row.allowances || 0);

  const c = calcPayroll({
    grossSalary: gross, workDaysActual: wdA, workDaysStandard: wdS, isTrialPeriod: isTrial,
    bonus, insuranceSalary, isCTV, dependentCount: dep, advance, allowance: allowanceTotal,
  } as any);

  const patch: any = {
    gross_salary: gross, bonus_amount: bonus, dependent_count: dep, advance_payment: advance,
    deduction_penalty: penalty,
    working_days_actual: wdA, working_days_standard: wdS,
    salary_by_workdays: Math.round(c.salaryByWorkdays), total_income: Math.round(c.totalIncome),
    employee_insurance: Math.round(c.employeeInsurance), employer_insurance: Math.round(c.employerInsurance),
    personal_deduction: Math.round(c.personalDeduction), dependent_deduction: Math.round(c.dependentDeduction),
    taxable_income: Math.round(c.taxableIncome), personal_income_tax: Math.round(c.tax),

    net_salary: (input.net_override !== undefined && input.net_override !== null) ? Math.round(input.net_override) : Math.round(c.netSalary - penalty),
    total_company_cost: Math.round(c.totalCompanyCost - penalty),
  };
  if (typeof input.note === "string") patch.note = input.note.slice(0, 500);

  const { error } = await sb.from("payroll").update(patch).eq("id", input.payroll_id);
  if (error) return { success: false, error: error.message };

  const logs: any[] = [];
  for (const f of ["gross_salary", "bonus_amount", "dependent_count", "advance_payment", "deduction_penalty", "net_salary"]) {
    if ((patch[f] ?? 0) !== (row[f] ?? 0))
      logs.push({ payroll_id: input.payroll_id, user_id: row.user_id, edited_by: adminId, field: f, old_value: row[f] || 0, new_value: patch[f], delta: (patch[f] || 0) - (row[f] || 0), reason: input.reason });
  }
  if (logs.length) await sb.from("payroll_edits").insert(logs);

  revalidatePath("/bang-luong");
  return { success: true, net: patch.net_salary, tax: patch.personal_income_tax };
}

export async function upsertBonusRule(input: Partial<any> & { name: string; bonus_rate: number; revenue_min: number; scope: string }) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("bonus_rules").upsert(input as any);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/bonus-rules");
  return { success: true };
}

export async function deleteBonusRule(id: string) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("bonus_rules").update({ active: false }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/bonus-rules");
  return { success: true };
}

export async function updateEmployeeSalary(input: { user_id: string; base_salary: number; insurance_salary: number; reason: string }) {
  const { sb, adminId } = await requireAdmin();
  if (!input.reason || input.reason.trim().length < 5) return { success: false, error: "Cần lý do ≥5 ký tự" };
  const { data: old } = await sb.from("users").select("base_salary, insurance_salary").eq("id", input.user_id).maybeSingle();
  if (!old) return { success: false, error: "Không tìm thấy NV" };
  const { error } = await sb.from("users")
    .update({ base_salary: input.base_salary, insurance_salary: input.insurance_salary })
    .eq("id", input.user_id);
  if (error) return { success: false, error: error.message };

  const hist: any[] = [];
  if ((old.base_salary ?? 0) !== input.base_salary)
    hist.push({ user_id: input.user_id, changed_by: adminId, field: "base_salary", old_value: String(old.base_salary ?? ""), new_value: String(input.base_salary), reason: input.reason });
  if ((old.insurance_salary ?? 0) !== input.insurance_salary)
    hist.push({ user_id: input.user_id, changed_by: adminId, field: "insurance_salary", old_value: String(old.insurance_salary ?? ""), new_value: String(input.insurance_salary), reason: input.reason });
  if (hist.length) { try { await sb.from("salary_history").insert(hist); } catch {} }
  revalidatePath("/bang-luong");
  revalidatePath("/nhan-su");
  return { success: true };
}
