"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function requireApprover() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "ceo", "manager"].includes(profile.role)) {
    throw new Error("Chỉ admin/manager được duyệt nghỉ");
  }
  return { sb, approverId: user.id };
}

export async function getAllLeaves(filter?: { status?: "pending" | "approved" | "rejected"; year?: number }) {
  const { sb } = await requireApprover();
  let q = sb.from("leaves")
    .select(`
      *,
      user:users!leaves_user_id_fkey(id, full_name, position, departments!users_department_id_fkey(name)),
      approver:users!leaves_approver_id_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.year) q = q.gte("from_date", `${filter.year}-01-01`).lte("from_date", `${filter.year}-12-31`);

  const { data } = await q;
  return data ?? [];
}

export async function approveLeave(leaveId: string, note?: string) {
  const { sb, approverId } = await requireApprover();
  const { error } = await sb.from("leaves").update({
    status: "approved",
    approver_id: approverId,
    approver_note: note || null,
    decided_at: new Date().toISOString(),
  }).eq("id", leaveId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/xin-nghi");
  revalidatePath("/xin-nghi");
  return { success: true };
}

export async function rejectLeave(leaveId: string, note: string) {
  if (!note || note.length < 3) return { success: false, error: "Cần ghi rõ lý do từ chối (≥3 ký tự)" };
  const { sb, approverId } = await requireApprover();
  const { error } = await sb.from("leaves").update({
    status: "rejected",
    approver_id: approverId,
    approver_note: note,
    decided_at: new Date().toISOString(),
  }).eq("id", leaveId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/xin-nghi");
  revalidatePath("/xin-nghi");
  return { success: true };
}

export async function getPendingCounts() {
  const { sb } = await requireApprover();
  const [leaves, corrections] = await Promise.all([
    sb.from("leaves").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("attendance_correction_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return {
    leaves: leaves.count ?? 0,
    corrections: corrections.count ?? 0,
    total: (leaves.count ?? 0) + (corrections.count ?? 0),
  };
}

export async function getLeaveStats(year: number) {
  const { sb } = await requireApprover();
  const { data } = await sb.from("leaves")
    .select("type, days, status, user_id")
    .gte("from_date", `${year}-01-01`)
    .lte("from_date", `${year}-12-31`)
    .eq("status", "approved");

  const byType: Record<string, number> = {};
  for (const l of data ?? []) {
    byType[l.type] = (byType[l.type] || 0) + (l.days || 0);
  }
  const totalDays = Object.values(byType).reduce((s, v) => s + v, 0);
  return { byType, totalDays, total: data?.length || 0 };
}
