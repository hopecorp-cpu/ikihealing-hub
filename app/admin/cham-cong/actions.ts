"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { calcLateMinutes, calcEarlyLeaveMinutes, vnDateStr } from "@/lib/payroll";
import { monthRange } from "@/lib/date-range";
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

export async function adminEditAttendance(input: {
  attendance_id: string;
  user_id: string;
  date: string;
  new_check_in?: string | null;
  new_check_out?: string | null;
  reason: string;
  waive_penalty?: boolean;
}) {
  const { sb, adminId } = await requireAdmin();
  if (!input.reason || input.reason.length < 5) return { success: false, error: "Cần lý do ≥5 ký tự" };

  const { data: old } = await sb.from("attendance").select("*").eq("id", input.attendance_id).maybeSingle();
  if (!old) return { success: false, error: "Không tìm thấy bản ghi" };

  const toIso = (date: string, time?: string | null) =>
    time ? new Date(`${date}T${time}:00+07:00`).toISOString() : null;

  const newCheckIn = input.new_check_in !== undefined ? toIso(input.date, input.new_check_in) : old.check_in_time;
  const newCheckOut = input.new_check_out !== undefined ? toIso(input.date, input.new_check_out) : old.check_out_time;

  const newLate = newCheckIn ? calcLateMinutes(newCheckIn) : 0;
  const newEarly = newCheckOut ? calcEarlyLeaveMinutes(newCheckOut) : 0;

  const updates: any = {
    check_in_time: newCheckIn,
    check_out_time: newCheckOut,
    late_minutes: newLate,
    early_leave_minutes: newEarly,
    status: newLate > 0 ? "late" : newEarly > 0 ? "early_leave" : (newCheckIn ? "normal" : null),
    missed_checkin: !newCheckIn,
    missed_checkout: newCheckIn && !newCheckOut
  };

  if (input.waive_penalty) {
    updates.penalty_amount = 0;
    updates.penalty_reason = `Miễn phạt — ${input.reason}`;
  }

  const { error: updErr } = await sb.from("attendance").update(updates).eq("id", input.attendance_id);
  if (updErr) return { success: false, error: updErr.message };

  await sb.from("attendance_edits").insert({
    attendance_id: input.attendance_id,
    edited_by: adminId,
    user_id: input.user_id,
    old_check_in: old.check_in_time,
    new_check_in: newCheckIn,
    old_check_out: old.check_out_time,
    new_check_out: newCheckOut,
    old_late_minutes: old.late_minutes,
    new_late_minutes: newLate,
    old_early_leave_minutes: old.early_leave_minutes,
    new_early_leave_minutes: newEarly,
    reason: input.reason
  });

  revalidatePath("/admin/cham-cong");
  revalidatePath("/cham-cong");
  return { success: true };
}

export async function reviewCorrectionRequest(input: {
  request_id: string;
  approve: boolean;
  apply_to_attendance: boolean;
  review_note?: string;
}) {
  const { sb, adminId } = await requireAdmin();
  const { data: req } = await sb.from("attendance_correction_requests").select("*").eq("id", input.request_id).maybeSingle();
  if (!req) return { success: false, error: "Không tìm thấy đơn" };

  await sb.from("attendance_correction_requests").update({
    status: input.approve ? "approved" : "rejected",
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString(),
    review_note: input.review_note
  }).eq("id", input.request_id);

  if (input.approve && input.apply_to_attendance) {
    const { data: att } = await sb.from("attendance")
      .select("id").eq("user_id", req.user_id).eq("date", req.attendance_date).maybeSingle();

    if (att) {

      await adminEditAttendance({
        attendance_id: att.id,
        user_id: req.user_id,
        date: req.attendance_date,
        new_check_in: req.requested_check_in ? new Date(req.requested_check_in).toISOString().slice(11, 16) : undefined,
        new_check_out: req.requested_check_out ? new Date(req.requested_check_out).toISOString().slice(11, 16) : undefined,
        reason: `Duyệt đơn: ${req.reason}`,
        waive_penalty: true
      });
    } else {

      const newLate = req.requested_check_in ? calcLateMinutes(req.requested_check_in) : 0;
      const newEarly = req.requested_check_out ? calcEarlyLeaveMinutes(req.requested_check_out) : 0;
      await sb.from("attendance").insert({
        user_id: req.user_id,
        date: req.attendance_date,
        check_in_time: req.requested_check_in,
        check_out_time: req.requested_check_out,
        late_minutes: newLate,
        early_leave_minutes: newEarly,
        status: newLate > 0 ? "late" : "normal",
        note: `[Admin duyệt đơn xin sửa] ${req.reason}`,
        penalty_amount: 0
      });
    }
  }

  revalidatePath("/admin/cham-cong");
  revalidatePath("/cham-cong");
  return { success: true };
}

export async function runDailyAttendanceCheck() {
  const { sb } = await requireAdmin();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const { data: cfg } = await sb.from("penalty_config")
    .select("rule_key,amount").eq("active", true);
  const penaltyByRule: Record<string, number> = Object.fromEntries((cfg ?? []).map((c: any) => [c.rule_key, c.amount]));

  const [{ data: yesterdayAtt }, { data: activeUsers }] = await Promise.all([
    sb.from("attendance").select("user_id,check_in_time,check_out_time,id").eq("date", yesterday),
    sb.from("users").select("id,full_name,work_mode").eq("active", true).neq("contract_type", "HĐ CTV")
  ]);

  const attByUser: Record<string, any> = Object.fromEntries((yesterdayAtt ?? []).map((a: any) => [a.user_id, a]));
  const issues: any[] = [];

  for (const u of activeUsers ?? []) {
    const att = attByUser[u.id];

    if (!att) {
      issues.push({ user: u, date: yesterday, type: "absent" });
      continue;
    }

    if (att.check_in_time && !att.check_out_time) {
      const penaltyAmount = penaltyByRule.missed_checkout || 50000;
      await sb.from("attendance").update({
        missed_checkout: true,
        penalty_amount: penaltyAmount,
        penalty_reason: `Quên check-out ngày ${yesterday}`
      }).eq("id", att.id);
      issues.push({ user: u, date: yesterday, type: "missed_checkout", amount: penaltyAmount });
    }

    if (!att.check_in_time && att.check_out_time) {
      const penaltyAmount = penaltyByRule.missed_checkin || 50000;
      await sb.from("attendance").update({
        missed_checkin: true,
        penalty_amount: penaltyAmount,
        penalty_reason: `Quên check-in ngày ${yesterday}`
      }).eq("id", att.id);
      issues.push({ user: u, date: yesterday, type: "missed_checkin", amount: penaltyAmount });
    }
  }

  revalidatePath("/admin/cham-cong");
  return { success: true, issuesFound: issues.length, issues };
}

export async function getAllAttendance(monthStr: string) {
  const { sb } = await requireAdmin();
  const { start, nextStart } = monthRange(monthStr);
  const { data } = await sb.from("attendance")
    .select("*, users!attendance_user_id_fkey(full_name, position, departments!users_department_id_fkey(name))")
    .gte("date", start)
    .lt("date", nextStart)
    .order("date", { ascending: false })
    .order("user_id");
  return data ?? [];
}

export async function getMonthlyWorkSummary(monthStr: string) {
  const { sb } = await requireAdmin();
  const [yy, mm] = monthStr.split("-").map(Number);
  const monthStart = `${monthStr}-01`;
  const nextStart = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
  const NC_STD = 26;

  const [{ data: users }, { data: att }, { data: leaves }, { data: shifts }] = await Promise.all([
    sb.from("users").select("id, full_name, position, contract_type, hourly_rate, departments!users_department_id_fkey(name)").eq("active", true),
    sb.from("attendance").select("user_id, check_in_time, late_minutes, early_leave_minutes").gte("date", monthStart).lt("date", nextStart),
    sb.from("leaves").select("user_id, type, status, days").gte("from_date", monthStart).lt("from_date", nextStart).eq("status", "approved"),

    sb.from("part_time_shifts").select("user_id, date, check_in_time, check_out_time").gte("date", monthStart).lt("date", nextStart),
  ]);

  const agg: Record<string, any> = {};
  for (const u of (users ?? [])) {
    agg[u.id] = {
      user_id: u.id, full_name: u.full_name, position: u.position,
      dept: (u as any).departments?.name || "",
      isTrial: /Thử việc/i.test(u.contract_type || ""),
      hourlyRate: u.hourly_rate || 0,
      workDays: 0, lateCount: 0, lateMin: 0, earlyMin: 0,
      phep: 0, om: 0, khongLuong: 0, raNgoai: 0,
      ptShiftCount: 0, ptHours: 0, _ptDays: new Set<string>(),
    };
  }
  for (const s of (shifts ?? [])) {
    const r = agg[s.user_id]; if (!r) continue;
    r.ptShiftCount += 1; r._ptDays.add(s.date);
    if (s.check_in_time && s.check_out_time) r.ptHours += Math.max(0, (new Date(s.check_out_time).getTime() - new Date(s.check_in_time).getTime()) / 3600e3);
  }
  for (const a of (att ?? [])) {
    const r = agg[a.user_id]; if (!r) continue;
    if (a.check_in_time) r.workDays += 1;
    if ((a.late_minutes || 0) > 0) { r.lateCount += 1; r.lateMin += a.late_minutes; }
    r.earlyMin += a.early_leave_minutes || 0;
  }
  for (const l of (leaves ?? [])) {
    const r = agg[l.user_id]; if (!r) continue;
    const d = l.days || 0;
    if (l.type === "phep") r.phep += d;
    else if (l.type === "om") r.om += d;
    else if (l.type === "khong_luong") r.khongLuong += d;
    else if (l.type === "ra_ngoai") r.raNgoai += d;
  }
  const rows = Object.values(agg).map((r: any) => {

    const paidLeave = r.isTrial ? 0 : (r.phep + r.om);
    let nc = Math.min(r.workDays + paidLeave, NC_STD);
    nc -= (r.lateMin + r.earlyMin) / 480 + r.khongLuong + r.raNgoai;
    r.ncPaid = Math.max(0, Math.round(nc * 10) / 10);

    r.ptDays = r._ptDays.size; delete r._ptDays;
    r.ptHours = Math.round(r.ptHours * 100) / 100;
    r.ptSalary = Math.round(r.ptHours * (r.hourlyRate || 0));
    r.isPartTime = r.ptShiftCount > 0 || (r.hourlyRate || 0) > 0;
    return r;
  }).sort((a: any, b: any) => b.workDays - a.workDays);

  return { rows, ncStandard: NC_STD };
}

export async function getPendingCorrectionRequests() {
  const { sb } = await requireAdmin();
  const { data } = await sb.from("attendance_correction_requests")
    .select("*, users!attendance_correction_requests_user_id_fkey(full_name, position)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getTodayAttendance(dateStr?: string) {
  const { sb } = await requireAdmin();
  const today = dateStr || vnDateStr();

  const [{ data: users }, { data: attendance }] = await Promise.all([
    sb.from("users")
      .select("id, full_name, position, work_mode, role, departments!users_department_id_fkey(name)")
      .eq("active", true)
      .neq("contract_type", "HĐ CTV")
      .order("full_name"),
    sb.from("attendance")
      .select("*")
      .eq("date", today)
  ]);

  const attByUser: Record<string, any> = Object.fromEntries((attendance ?? []).map((a: any) => [a.user_id, a]));

  const rows = (users ?? []).map((u: any) => {
    const att = attByUser[u.id];
    let status: "ok" | "late" | "early" | "no_checkin" | "no_checkout" | "absent";
    if (!att) status = "absent";
    else if (!att.check_in_time && att.check_out_time) status = "no_checkin";
    else if (att.check_in_time && !att.check_out_time) {

      const now = new Date();
      const hour = now.getHours();
      status = hour >= 18 ? "no_checkout" : (att.late_minutes > 0 ? "late" : "ok");
    }
    else if (att.late_minutes > 0) status = "late";
    else if (att.early_leave_minutes > 0) status = "early";
    else status = "ok";

    return {
      user_id: u.id,
      full_name: u.full_name,
      position: u.position,
      department: u.departments?.name ?? null,
      work_mode: u.work_mode,
      role: u.role,
      attendance_id: att?.id ?? null,
      check_in_time: att?.check_in_time ?? null,
      check_out_time: att?.check_out_time ?? null,
      late_minutes: att?.late_minutes ?? 0,
      early_leave_minutes: att?.early_leave_minutes ?? 0,
      work_location: att?.work_location ?? null,
      check_in_photo_url: att?.check_in_photo_url ?? null,
      check_out_photo_url: att?.check_out_photo_url ?? null,
      status,
    };
  });

  const summary = {
    total: rows.length,
    checkedIn: rows.filter(r => r.check_in_time).length,
    checkedOut: rows.filter(r => r.check_out_time).length,
    late: rows.filter(r => r.late_minutes > 0).length,
    absent: rows.filter(r => r.status === "absent").length,
    no_checkout: rows.filter(r => r.status === "no_checkout").length,
    remote: rows.filter(r => r.work_location === "remote").length,
  };

  return { rows, summary, date: today };
}

export async function getAttendanceEditHistory(userId?: string) {
  const { sb } = await requireAdmin();
  let q = sb.from("attendance_edits")
    .select("*, users!attendance_edits_user_id_fkey(full_name), editor:users!attendance_edits_edited_by_fkey(full_name)");
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.order("edited_at", { ascending: false }).limit(50);
  return data ?? [];
}

export async function getGpsUnverifiedAttendance(monthStr: string) {
  const { sb } = await requireAdmin();
  const { start, nextStart } = monthRange(monthStr);
  const { data, error } = await sb.from("attendance")
    .select("id, user_id, date, check_in_time, check_out_time, check_in_photo_url, note, users!attendance_user_id_fkey(full_name, position)")
    .eq("gps_unverified", true)
    .gte("date", start).lt("date", nextStart)
    .order("date", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function approveGpsAttendance(id: string) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("attendance")
    .update({ gps_unverified: false, note: "✓ GPS đã được admin xác minh" })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/cham-cong");
  revalidatePath("/cham-cong");
  return { success: true };
}

export async function rejectGpsAttendance(id: string) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("attendance").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/cham-cong");
  revalidatePath("/cham-cong");
  return { success: true };
}

export async function approveAllGpsAttendance(monthStr: string) {
  const { sb } = await requireAdmin();
  const { start, nextStart } = monthRange(monthStr);
  const { data, error } = await sb.from("attendance")
    .update({ gps_unverified: false, note: "✓ GPS đã được admin xác minh (duyệt hàng loạt)" })
    .eq("gps_unverified", true)
    .gte("date", start).lt("date", nextStart)
    .select("id");
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/cham-cong");
  revalidatePath("/cham-cong");
  return { success: true, count: (data ?? []).length };
}
