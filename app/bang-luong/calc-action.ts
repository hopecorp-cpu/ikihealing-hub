"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import {
  calcLeaderSaleBonus, calcSaleBonus, calcTrucPageBonus, calcGroupBonus,
  calcPayroll, detectSaleType, LAW_2026
} from "@/lib/payroll";
import { computeMonthlyNC, leaveDaysInMonth } from "@/lib/nc";
import { calcDeptKpiBonus, calcChuyenCan, CHUYEN_CAN_DEFAULT, type KpiRow } from "@/lib/dept-comp";
import { getConfigNumber, getConfigValue } from "@/lib/app-config";
import { revalidatePath } from "next/cache";

export async function calcPayrollForMonth(month: string) {
  const auth = getServerClient();
  const { data: { user: authUser } } = await auth.auth.getUser();
  if (!authUser) return { success: false, error: "Chưa đăng nhập" };

  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", authUser.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) {
    return { success: false, error: "Chỉ admin/ceo được chốt lương" };
  }

  const monthStart = `${month}-01`;
  const [yyyy, mm] = month.split("-").map(Number);
  const nextMonthStart = mm === 12 ? `${yyyy + 1}-01-01` : `${yyyy}-${String(mm + 1).padStart(2, "0")}-01`;
  const { data: users } = await sb.from("users").select("*")
    .or(`active.eq.true,and(terminated_at.gte.${monthStart},terminated_at.lt.${nextMonthStart})`);
  if (!users || users.length === 0) return { success: false, error: "Không có NV cần tính lương" };

  const m = parseInt(month.slice(5));
  const y = month.slice(0, 4);
  const { data: cycles } = await sb.from("cycles").select("id").eq("name", `T${m}/${y}`).limit(1);
  const cycleId = cycles?.[0]?.id;

  const dsMap: Record<string, { gross: number; cr: number; refund: number }> = {};
  if (cycleId) {
    const { data: sales } = await sb.from("sales_revenue").select("*").eq("cycle_id", cycleId);
    (sales ?? []).forEach((s: any) => {
      const cur = dsMap[s.user_id] || { gross: 0, cr: 0, refund: 0 };
      cur.gross += Number(s.gross_revenue) || 0;
      cur.cr = s.cr_percent ?? cur.cr;
      cur.refund = s.refund_percent ?? cur.refund;
      dsMap[s.user_id] = cur;
    });
  }

  const contractMap: Record<string, string> = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.contract_type || ""]));
  const isTrialUser = (uid: string) => /Thử việc/i.test(contractMap[uid] || "");
  const unpaidLeaveMap: Record<string, number> = {};

  const monthEndStr = `${month}-${String(new Date(yyyy, mm, 0).getDate()).padStart(2, "0")}`;
  const { data: leaves } = await sb.from("leaves").select("user_id, type, status, days, from_date, to_date")
    .lte("from_date", monthEndStr)
    .or(`to_date.gte.${monthStart},to_date.is.null`)
    .eq("status", "approved");
  (leaves ?? []).forEach((l: any) => {
    const isUnpaidType = l.type === "ra_ngoai" || l.type === "khong_luong";
    const isTrialPaidType = (l.type === "phep" || l.type === "om") && isTrialUser(l.user_id);
    if (isUnpaidType || isTrialPaidType) {
      unpaidLeaveMap[l.user_id] = (unpaidLeaveMap[l.user_id] || 0) + leaveDaysInMonth(l, month);
    }
  });

  const kpiByUser: Record<string, KpiRow[]> = {};
  if (cycleId) {
    const { data: kpiRows } = await sb.from("kpis")
      .select("user_id, title, metric_unit, target_value, current_value, weight_percent, is_lower_better")
      .eq("cycle_id", cycleId);
    (kpiRows ?? []).forEach((k: any) => {
      (kpiByUser[k.user_id] ||= []).push(k);
    });
  }

  const lateByUser: Record<string, { lateDays: number; bigLateDays: number }> = {};
  const { data: attRows } = await sb.from("attendance")
    .select("user_id, late_minutes, early_leave_minutes")
    .gte("date", monthStart).lt("date", nextMonthStart);
  (attRows ?? []).forEach((a: any) => {
    const late = (Number(a.late_minutes) || 0) + (Number(a.early_leave_minutes) || 0);
    if (late <= 0) return;
    const cur = lateByUser[a.user_id] || { lateDays: 0, bigLateDays: 0 };
    cur.lateDays += 1;
    if ((Number(a.late_minutes) || 0) >= 15) cur.bigLateDays += 1;
    lateByUser[a.user_id] = cur;
  });
  const chuyenCanAmount = await getConfigNumber("chuyen_can_amount", CHUYEN_CAN_DEFAULT);

  const deptCompActive = (await getConfigValue("dept_comp_active")) === "1";

  const groupSaleDsGross = users
    .filter(u => detectSaleType(u.position ?? "") !== "none")
    .reduce((s, u) => s + (dsMap[u.id]?.gross || 0), 0);
  const groupBonusTotal = calcGroupBonus(groupSaleDsGross, 400_000_000);

  await sb.from("payroll").delete().eq("month", month).eq("status", "draft");

  const inserts: any[] = [];
  const summary: any[] = [];

  for (const u of users) {
    const ct = u.contract_type ?? "Chính thức";

    const isCTV = /CTV|Dịch Vụ|Part-time|Khoán việc/i.test(ct);
    const isTrial = /Thử việc/i.test(ct);

    const { ncStandard, ncActual } = computeMonthlyNC({
      month,
      hireDate: u.hire_date,
      terminatedAt: u.terminated_at,
      unpaidLeaveDays: unpaidLeaveMap[u.id] || 0,
    });

    const ds = dsMap[u.id];
    const dsGross = ds?.gross || 0;
    const dsNet = dsGross / (1 + LAW_2026.vatSanPhamA);
    const saleType = detectSaleType(u.position);

    let bonus = 0;
    const parts: string[] = [];
    if (dsGross > 0) {
      if (saleType === "leader_sale") {
        const personal = calcLeaderSaleBonus(dsGross);
        bonus += personal + groupBonusTotal;
        parts.push(`HH cá nhân ${personal.toLocaleString("vi-VN")} + thưởng nhóm ${groupBonusTotal.toLocaleString("vi-VN")}`);
      } else if (saleType === "sale") {
        bonus += calcSaleBonus(dsGross);
        parts.push(`Tier Sale NV (target 100M)`);
      } else if (saleType === "truc_page") {
        bonus += calcTrucPageBonus(dsGross, true);
        parts.push(`1.5% × DS net + 300K chuyên cần`);
      }
    }

    if (deptCompActive && saleType === "none") {
      const kr = calcDeptKpiBonus(u.max_bonus || 0, kpiByUser[u.id] || []);
      if (kr.bonus > 0) { bonus += kr.bonus; parts.push(kr.explanation); }
    }

    if (deptCompActive && saleType === "none" && !isCTV) {
      const cc = calcChuyenCan({
        amount: chuyenCanAmount,
        lateDays: lateByUser[u.id]?.lateDays || 0,
        bigLateDays: lateByUser[u.id]?.bigLateDays || 0,
        unpaidLeaveDays: unpaidLeaveMap[u.id] || 0,
      });
      if (cc.amount > 0) { bonus += cc.amount; parts.push(`Chuyên cần ${cc.amount.toLocaleString("vi-VN")}`); }
    }

    const bonusBreakdown = parts.join(" + ");

    const calc = calcPayroll({
      grossSalary: u.base_salary || 0,
      insuranceSalary: u.insurance_salary || 0,
      workDaysStandard: ncStandard,
      workDaysActual: ncActual,
      bonus,
      isCTV,
      isTrialPeriod: isTrial,
      dependentCount: u.dependent_count || 0,
      advance: 0
    });

    inserts.push({
      user_id: u.id,
      month,
      base_salary: u.insurance_salary || 0,
      gross_salary: u.base_salary || 0,
      working_days_standard: ncStandard,
      working_days_actual: Math.round(ncActual * 10) / 10,
      salary_by_workdays: calc.salaryByWorkdays,
      sales_revenue_net: Math.round(dsNet),
      bonus_amount: bonus,
      total_income: calc.totalIncome,
      employee_insurance: calc.employeeInsurance,
      personal_deduction: calc.personalDeduction,
      dependent_count: u.dependent_count || 0,
      dependent_deduction: calc.dependentDeduction,
      taxable_income: calc.taxableIncome,
      personal_income_tax: calc.tax,
      net_salary: calc.netSalary,
      employer_insurance: calc.employerInsurance,
      total_company_cost: calc.totalCompanyCost,
      note: bonusBreakdown,
      status: "draft"
    });
    summary.push({ name: u.full_name, position: u.position, bonus, netSalary: calc.netSalary, isTrial });
  }

  const { error } = await sb.from("payroll").insert(inserts);
  if (error) return { success: false, error: error.message };

  revalidatePath("/bang-luong");
  return {
    success: true,
    count: inserts.length,
    summary,
    groupBonusTotal,
    groupSaleDsGross
  };
}
