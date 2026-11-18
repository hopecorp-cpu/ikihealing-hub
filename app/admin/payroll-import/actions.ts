"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { parsePayrollExcel, type ParsedSheet } from "@/lib/payroll-excel-parser";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const auth = getServerClient();
  const { data: { user: authUser } } = await auth.auth.getUser();
  if (!authUser) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", authUser.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) {
    throw new Error("Không có quyền");
  }
  return { sb, adminId: authUser.id };
}

const normalize = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();

export async function previewPayrollExcel(input: { fileBase64: string }) {
  try {
    const { sb } = await requireAdmin();
    const buf = Buffer.from(input.fileBase64, "base64");
    const sheets = parsePayrollExcel(new Uint8Array(buf));

    const { data: users } = await sb.from("users").select("id, full_name, email, position");
    const userByName = new Map((users ?? []).map((u: any) => [normalize(u.full_name), u]));

    const previews = sheets.map(s => ({
      ...s,
      rows: s.rows.map(r => ({
        ...r,
        matched_user: userByName.get(normalize(r.empName)) || null
      }))
    }));

    const stats = {
      totalSheets: sheets.length,
      totalRows: sheets.reduce((sum, s) => sum + s.rows.length, 0),
      matched: previews.reduce((sum, s) => sum + s.rows.filter((r: any) => r.matched_user).length, 0),
      unmatched: previews.reduce((sum, s) => sum + s.rows.filter((r: any) => !r.matched_user).length, 0),
      totalNet: sheets.reduce((sum, s) => sum + s.rows.reduce((a, r) => a + r.net_salary, 0), 0),
      totalCost: sheets.reduce((sum, s) => sum + s.rows.reduce((a, r) => a + r.total_company_cost, 0), 0)
    };

    return { success: true, sheets: previews, stats };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function commitPayrollImport(input: { fileBase64: string; status: "draft" | "approved" | "paid" }) {
  const { sb, adminId } = await requireAdmin();
  const buf = Buffer.from(input.fileBase64, "base64");
  const sheets = parsePayrollExcel(new Uint8Array(buf));
  if (sheets.length === 0) return { success: false, error: "Không tìm được sheet 'Tháng X.YYYY' nào trong file" };

  const { data: users } = await sb.from("users").select("id, full_name");
  const userByName = new Map((users ?? []).map((u: any) => [normalize(u.full_name), u]));

  const allRows: any[] = [];
  const unmatched: { month: string; empName: string }[] = [];

  for (const sheet of sheets) {
    for (const r of sheet.rows) {
      const user = userByName.get(normalize(r.empName));
      if (!user) { unmatched.push({ month: sheet.month, empName: r.empName }); continue; }
      allRows.push({
        user_id: user.id,
        month: sheet.month,
        base_salary: r.base_salary,
        gross_salary: r.gross_salary,
        working_days_standard: r.working_days_standard,
        working_days_actual: r.working_days_actual,
        salary_by_workdays: r.salary_by_workdays,
        bonus_amount: r.bonus_amount,
        total_income: r.total_income,
        employee_insurance: r.employee_insurance,
        personal_deduction: r.personal_deduction,
        taxable_income: r.taxable_income,
        personal_income_tax: r.personal_income_tax,
        advance_payment: r.advance_payment,
        net_salary: r.net_salary,
        employer_insurance: r.employer_insurance,
        total_company_cost: r.total_company_cost,
        status: input.status,
        note: `Imported Excel: ${sheet.sheetName}`,
        auto_calc_data: {
          source: "excel_import",
          excel_sheet: sheet.sheetName,
          imported_by: adminId,
          imported_at: new Date().toISOString()
        }
      });
    }
  }

  let done = 0;
  for (let i = 0; i < allRows.length; i += 50) {
    const batch = allRows.slice(i, i + 50);
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/payroll?on_conflict=user_id,month`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(batch)
    });
    if (r.ok) done += batch.length;
  }

  revalidatePath("/bang-luong");
  revalidatePath("/phieu-luong");
  return { success: true, imported: done, unmatched };
}
