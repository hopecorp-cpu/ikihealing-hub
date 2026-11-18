"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { calcOutDuringWorkMinutes } from "@/lib/payroll";
import { revalidatePath } from "next/cache";

async function getAuthUserId(): Promise<{ id: string; name?: string } | null> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const sb = getServiceClient();
  const { data } = await sb.from("users").select("full_name").eq("id", user.id).maybeSingle();
  return { id: user.id, name: data?.full_name };
}

export type LeaveType = "phep" | "om" | "khong_luong" | "ot" | "cong_tac" | "hieu_hi" | "ra_ngoai";

export async function submitLeave(input: {
  type: LeaveType;
  from_date: string;
  to_date: string;
  days: number;
  from_time?: string;
  to_time?: string;
  reason: string;
}) {
  const u = await getAuthUserId();
  if (!u) return { success: false, error: "Chưa đăng nhập" };

  if (input.type === "ra_ngoai") {
    if (!input.from_date || !input.from_time || !input.to_time) {
      return { success: false, error: "Cần điền ngày + giờ ra + giờ về" };
    }
    if (input.from_time >= input.to_time) {
      return { success: false, error: "Giờ về phải sau giờ ra" };
    }
  } else {
    if (!input.from_date || !input.to_date || input.days <= 0) {
      return { success: false, error: "Điền đủ thông tin ngày" };
    }
  }

  let days = input.days;
  if (input.type === "ra_ngoai" && input.from_time && input.to_time) {
    const minutes = calcOutDuringWorkMinutes(input.from_time, input.to_time);
    days = Number((minutes / 480).toFixed(2));
  }

  const sb = getServiceClient();
  const payload: any = {
    user_id: u.id,
    type: input.type,
    from_date: input.from_date,
    to_date: input.type === "ra_ngoai" ? input.from_date : input.to_date,
    days,
    reason: input.reason,
    status: "pending"
  };
  if (input.type === "ra_ngoai") {
    payload.from_time = input.from_time;
    payload.to_time = input.to_time;
  }

  const { error } = await sb.from("leaves").insert(payload);
  if (error) return { success: false, error: error.message };

  revalidatePath("/xin-nghi");
  return { success: true, daysCalculated: days };
}

export async function getMyLeaves() {
  const u = await getAuthUserId();
  if (!u) return [];
  const sb = getServiceClient();
  const { data } = await sb.from("leaves").select("*").eq("user_id", u.id).order("created_at", { ascending: false });
  return data ?? [];
}

export async function decideLeave(leaveId: string, decision: "approved" | "rejected", note: string) {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { success: false, error: "Chưa đăng nhập" };

  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "ceo", "manager"].includes(profile.role)) {
    return { success: false, error: "Không có quyền duyệt" };
  }

  const { error } = await sb.from("leaves").update({
    status: decision,
    approver_id: user.id,
    approver_note: note,
    decided_at: new Date().toISOString()
  }).eq("id", leaveId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/xin-nghi");
  return { success: true };
}
