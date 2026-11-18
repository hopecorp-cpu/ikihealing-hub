"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function requireManagerOrAdmin() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "ceo", "manager"].includes(profile.role)) {
    throw new Error("Chỉ admin/manager được xem");
  }
  return { sb, viewerId: user.id, role: profile.role };
}

export async function getDailyReportsByDepartment(dateStr: string) {
  const { sb } = await requireManagerOrAdmin();

  const [{ data: depts }, { data: users }, { data: reports }] = await Promise.all([
    sb.from("departments").select("id, name, color").order("name"),
    sb.from("users")
      .select("id, full_name, position, department_id, role")
      .eq("active", true)
      .neq("contract_type", "HĐ CTV")
      .order("full_name"),
    sb.from("daily_reports")
      .select("*, reviewer:users!daily_reports_user_id_fkey(full_name)")
      .eq("report_date", dateStr),
  ]);

  const reportByUser: Record<string, any> = Object.fromEntries((reports ?? []).map((r: any) => [r.user_id, r]));

  const byDept: Record<string, any[]> = {};
  const unassigned: any[] = [];
  for (const u of users ?? []) {
    const row = {
      ...u,
      report: reportByUser[u.id] || null,
    };
    if (u.department_id) (byDept[u.department_id] ||= []).push(row);
    else unassigned.push(row);
  }

  const departments = (depts ?? []).map((d: any) => {
    const members = byDept[d.id] || [];
    const submitted = members.filter(m => m.report).length;
    const reviewed = members.filter(m => m.report?.status === "reviewed").length;
    const totalRevenue = members.reduce((s, m) => s + (m.report?.revenue_today || 0), 0);
    const totalCalls = members.reduce((s, m) => s + (m.report?.calls_made || 0), 0);
    const totalOrders = members.reduce((s, m) => s + (m.report?.orders_closed || 0), 0);
    const blockers = members.filter(m => m.report?.blockers).map(m => ({
      user: m.full_name,
      text: m.report.blockers,
    }));
    return {
      ...d,
      members,
      summary: {
        total: members.length,
        submitted,
        reviewed,
        rate: members.length > 0 ? Math.round((submitted / members.length) * 100) : 0,
        totalRevenue,
        totalCalls,
        totalOrders,
        blockers,
      },
    };
  });

  const allMembers = Object.values(byDept).flat().concat(unassigned);
  const overall = {
    totalUsers: allMembers.length,
    submitted: allMembers.filter(m => m.report).length,
    reviewed: allMembers.filter(m => m.report?.status === "reviewed").length,
    blockers: allMembers.filter(m => m.report?.blockers).length,
    totalRevenue: allMembers.reduce((s, m) => s + (m.report?.revenue_today || 0), 0),
    totalCalls: allMembers.reduce((s, m) => s + (m.report?.calls_made || 0), 0),
    totalOrders: allMembers.reduce((s, m) => s + (m.report?.orders_closed || 0), 0),
  };

  return { departments, unassigned, overall, date: dateStr };
}

export async function addManagerComment(reportId: string, comment: string) {
  if (!comment || comment.length < 3) return { success: false, error: "Cần nhập comment ≥3 ký tự" };
  const { sb, viewerId } = await requireManagerOrAdmin();
  const { error } = await sb.from("daily_reports").update({
    manager_comment: comment,
    manager_seen: true,
    status: "reviewed",
    reviewed_at: new Date().toISOString(),
  }).eq("id", reportId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/daily-report");
  return { success: true };
}

export async function markAsSeen(reportId: string) {
  const { sb } = await requireManagerOrAdmin();
  const { error } = await sb.from("daily_reports").update({
    manager_seen: true,
  }).eq("id", reportId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/daily-report");
  return { success: true };
}

export async function getUnreviewedReportsCount() {
  const { sb } = await requireManagerOrAdmin();
  const { count } = await sb.from("daily_reports")
    .select("id", { count: "exact", head: true })
    .neq("status", "reviewed");
  return count ?? 0;
}

export async function getWeeklyComplianceTrend() {
  const { sb } = await requireManagerOrAdmin();
  const today = new Date();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400 * 1000);
    days.push(d.toISOString().slice(0, 10));
  }

  const { data: users } = await sb.from("users")
    .select("id").eq("active", true).neq("contract_type", "HĐ CTV");
  const totalActive = users?.length || 1;

  const { data: reports } = await sb.from("daily_reports")
    .select("report_date")
    .in("report_date", days);

  const countByDate: Record<string, number> = {};
  for (const r of reports ?? []) {
    countByDate[r.report_date] = (countByDate[r.report_date] || 0) + 1;
  }

  return days.map(d => ({
    date: d,
    submitted: countByDate[d] || 0,
    total: totalActive,
    rate: Math.round(((countByDate[d] || 0) / totalActive) * 100),
  }));
}
