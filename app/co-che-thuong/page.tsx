import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/auth";
import { detectSaleType } from "@/lib/payroll";
import { getConfigNumber, getConfigValue } from "@/lib/app-config";
import { calcDeptKpiBonus, calcChuyenCan, CHUYEN_CAN_DEFAULT, type KpiRow } from "@/lib/dept-comp";
import { leaveDaysInMonth } from "@/lib/nc";
import CompClient, { type PersonComp } from "./CompClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Cơ chế thưởng phòng ban | ACME Ops Hub") };
}

export default async function Page({ searchParams }: { searchParams: { cycle?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect("/?denied=co-che-thuong");

  const sb = getServiceClient();

  const { data: cycles } = await sb.from("cycles").select("id, name, type, start_date, status").order("start_date", { ascending: false });
  const cycleList = (cycles ?? []).map((c: any) => ({ id: c.id, name: c.name, status: c.status }));
  const selected = searchParams.cycle && cycleList.some(c => c.id === searchParams.cycle)
    ? searchParams.cycle
    : (cycleList.find(c => c.status === "active")?.id || cycleList[0]?.id || "");
  const selCycle = (cycles ?? []).find((c: any) => c.id === selected);
  const month = selCycle?.start_date ? String(selCycle.start_date).slice(0, 7) : "";

  const [{ data: users }, { data: depts }] = await Promise.all([
    sb.from("users").select("id, full_name, position, department_id, contract_type, max_bonus, active").eq("active", true),
    sb.from("departments").select("id, name"),
  ]);
  const deptName = new Map((depts ?? []).map((d: any) => [d.id, d.name]));

  const kpiByUser: Record<string, (KpiRow & { id: string })[]> = {};
  if (selected) {
    const { data: kpiRows } = await sb.from("kpis")
      .select("id, user_id, title, metric_unit, target_value, current_value, weight_percent, is_lower_better")
      .eq("cycle_id", selected);
    (kpiRows ?? []).forEach((k: any) => { (kpiByUser[k.user_id] ||= []).push(k); });
  }

  const lateByUser: Record<string, { lateDays: number; bigLateDays: number }> = {};
  const unpaidByUser: Record<string, number> = {};
  if (month) {
    const [yy, mm] = month.split("-").map(Number);
    const monthStart = `${month}-01`;
    const nextStart = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
    const monthEndStr = `${month}-${String(new Date(yy, mm, 0).getDate()).padStart(2, "0")}`;
    const [{ data: att }, { data: leaves }] = await Promise.all([
      sb.from("attendance").select("user_id, late_minutes, early_leave_minutes").gte("date", monthStart).lt("date", nextStart),
      sb.from("leaves").select("user_id, type, days, from_date, to_date, status").lte("from_date", monthEndStr).or(`to_date.gte.${monthStart},to_date.is.null`).eq("status", "approved"),
    ]);
    (att ?? []).forEach((a: any) => {
      const late = (Number(a.late_minutes) || 0) + (Number(a.early_leave_minutes) || 0);
      if (late <= 0) return;
      const c = lateByUser[a.user_id] || { lateDays: 0, bigLateDays: 0 };
      c.lateDays += 1; if ((Number(a.late_minutes) || 0) >= 15) c.bigLateDays += 1;
      lateByUser[a.user_id] = c;
    });
    (leaves ?? []).forEach((l: any) => {
      if (l.type === "khong_luong" || l.type === "ra_ngoai") unpaidByUser[l.user_id] = (unpaidByUser[l.user_id] || 0) + leaveDaysInMonth(l, month);
    });
  }

  const chuyenCanAmount = await getConfigNumber("chuyen_can_amount", CHUYEN_CAN_DEFAULT);
  const deptCompActive = (await getConfigValue("dept_comp_active")) === "1";
  const isCTV = (ct: string) => /CTV|Dịch Vụ|Part-time|Khoán việc/i.test(ct || "");

  const people: PersonComp[] = (users ?? [])
    .filter((u: any) => detectSaleType(u.position) === "none")
    .map((u: any) => {
      const kpis = kpiByUser[u.id] || [];
      const kr = calcDeptKpiBonus(u.max_bonus || 0, kpis);
      const cc = isCTV(u.contract_type)
        ? { amount: 0, reason: "CTV / Part-time — không áp chuyên cần" }
        : calcChuyenCan({ amount: chuyenCanAmount, lateDays: lateByUser[u.id]?.lateDays || 0, bigLateDays: lateByUser[u.id]?.bigLateDays || 0, unpaidLeaveDays: unpaidByUser[u.id] || 0 });
      return {
        id: u.id, name: u.full_name, position: u.position || "—",
        dept: deptName.get(u.department_id) || "—",
        contract: u.contract_type || "—",
        maxBonus: u.max_bonus || 0,
        kpis: kpis.map(k => ({ id: (k as any).id, title: k.title || "", metric_unit: k.metric_unit || "", target_value: Number(k.target_value) || 0, current_value: k.current_value == null ? null : Number(k.current_value), weight_percent: Number(k.weight_percent) || 0, is_lower_better: (k as any).is_lower_better ?? null })),
        completion: kr.completion, bandLabel: kr.bandLabel, kpiBonus: kr.bonus,
        chuyenCan: cc.amount, chuyenCanReason: cc.reason,
        lateDays: lateByUser[u.id]?.lateDays || 0,
      };
    })
    .sort((a, b) => a.dept.localeCompare(b.dept) || a.name.localeCompare(b.name));

  return (
    <CompClient
      cycles={cycleList}
      selectedCycle={selected}
      month={month}
      people={people}
      chuyenCanAmount={chuyenCanAmount}
      active={deptCompActive}
    />
  );
}
