"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { calcLateMinutes, calcEarlyLeaveMinutes, WORK_HOURS, isInsideOffice, OFFICE_LOCATION, validateCheckInLocation, vanPhongCua, vnDateStr, type WorkMode } from "@/lib/payroll";
import { revalidatePath } from "next/cache";
import { monthRange } from "@/lib/date-range";

async function getAuthUserId(): Promise<string | null> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  return user?.id ?? null;
}

async function getUserWorkMode(userId: string): Promise<WorkMode> {
  const sb = getServiceClient();
  const { data } = await sb.from("users").select("work_mode").eq("id", userId).maybeSingle();
  const mode = (data?.work_mode as WorkMode) ?? "office";
  return mode;
}

async function getUserAuthMeta(userId: string): Promise<{ workMode: WorkMode; role: string; contractType: string; email: string }> {
  const sb = getServiceClient();
  const { data } = await sb.from("users").select("work_mode, role, contract_type, email").eq("id", userId).maybeSingle();
  return {
    email: data?.email ?? "",
    workMode: (data?.work_mode as WorkMode) ?? "office",
    role: data?.role ?? "employee",
    contractType: data?.contract_type ?? "Chính thức",
  };
}

function isAdminLike(role: string): boolean {
  return role === "admin" || role === "ceo";
}

function isFlexibleHours(contractType: string): boolean {
  return contractType === "Part-time" || contractType === "HĐ CTV" || contractType === "Khoán việc";
}

async function uploadAttendancePhoto(userId: string, type: "in" | "out", base64: string): Promise<string | null> {
  try {
    const sb = getServiceClient();

    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Buffer.from(base64Data, "base64");

    const fileName = `${userId}/${vnDateStr()}-${type}-${Date.now()}.jpg`;
    const { error } = await sb.storage.from("attendance-photos").upload(fileName, bytes, {
      contentType: "image/jpeg",
      upsert: false
    });
    if (error) {
      console.error("Upload photo error:", error.message);
      return null;
    }
    const { data: publicUrl } = sb.storage.from("attendance-photos").getPublicUrl(fileName);
    return publicUrl.publicUrl;
  } catch (e: any) {
    console.error("Photo upload exception:", e.message);
    return null;
  }
}

export async function checkIn(payload: { lat: number | null; lng: number | null; accuracy?: number | null; note?: string; photo?: string }) {
  const userId = await getAuthUserId();
  if (!userId) return { success: false, error: "Chưa đăng nhập" };

  const { workMode, role, contractType, email } = await getUserAuthMeta(userId);
  let geo = validateCheckInLocation(workMode, payload.lat, payload.lng, payload.accuracy, vanPhongCua(email));
  let gpsUnverified = false;

  if (!geo.ok && isAdminLike(role)) {
    geo = {
      ok: true,
      workLocation: payload.lat == null ? "office" : geo.workLocation,
      distance: geo.distance,
      message: `✓ Admin bypass — ${geo.message || "không kiểm tra GPS"}`,
    };
  } else if (!geo.ok && payload.lat == null) {

    gpsUnverified = true;
    geo = { ok: true, workLocation: "office", distance: null, message: "✓ Check-in (GPS chưa xác minh — chờ duyệt)" };
  }
  if (!geo.ok) return { success: false, error: geo.message };

  const sb = getServiceClient();

  let gpsFlagReady = false;
  if (gpsUnverified) {
    const { error: probe } = await sb.from("attendance").select("gps_unverified").limit(1);
    gpsFlagReady = !probe;
  }
  const today = new Date();
  const dateStr = vnDateStr(today);
  const now = today.toISOString();

  const { data: existing } = await sb.from("attendance").select("id, check_in_time").eq("user_id", userId).eq("date", dateStr).maybeSingle();
  if (existing?.check_in_time) return { success: false, error: "Hôm nay đã check-in rồi" };

  const flexHours = isFlexibleHours(contractType);
  const lateMin = flexHours ? 0 : calcLateMinutes(now);
  const status = flexHours ? "normal" : (lateMin > 0 ? "late" : "normal");

  let photoUrl: string | null = null;
  if (payload.photo) {
    photoUrl = await uploadAttendancePhoto(userId, "in", payload.photo);
  }

  const payloadDb: any = {
    check_in_time: now,
    check_in_lat: payload.lat,
    check_in_lng: payload.lng,
    late_minutes: lateMin,
    status,
    work_location: geo.workLocation
  };
  if (photoUrl) payloadDb.check_in_photo_url = photoUrl;
  if (gpsUnverified && gpsFlagReady) payloadDb.gps_unverified = true;
  const noteFinal = gpsUnverified ? "GPS chưa xác minh — chờ admin duyệt" : payload.note;

  if (existing) {
    const { error } = await sb.from("attendance").update({ ...payloadDb, ...(noteFinal ? { note: noteFinal } : {}) }).eq("id", existing.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await sb.from("attendance").insert({
      user_id: userId,
      date: dateStr,
      ...payloadDb,
      note: noteFinal
    });
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/cham-cong");
  const timeStr = today.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const locTag = geo.workLocation === "remote" ? " (remote)" : "";
  return {
    success: true,
    time: timeStr,
    lateMinutes: lateMin,
    photoUploaded: !!photoUrl,
    workLocation: geo.workLocation,
    message: lateMin > 0 ? `Check-in lúc ${timeStr}${locTag} — đi muộn ${lateMin} phút` : `Check-in lúc ${timeStr}${locTag} — đúng giờ`
  };
}

export async function checkOut(payload: { lat: number | null; lng: number | null; accuracy?: number | null; photo?: string }) {
  const userId = await getAuthUserId();
  if (!userId) return { success: false, error: "Chưa đăng nhập" };

  const { workMode, role, contractType, email } = await getUserAuthMeta(userId);
  const geo = validateCheckInLocation(workMode, payload.lat, payload.lng, payload.accuracy, vanPhongCua(email));
  const workLocation = geo.workLocation || (payload.lat == null ? "office" : "remote");

  const sb = getServiceClient();
  const dateStr = vnDateStr();
  const now = new Date().toISOString();

  const { data: existing } = await sb.from("attendance").select("id, check_in_time, check_out_time, status").eq("user_id", userId).eq("date", dateStr).maybeSingle();
  if (!existing || !existing.check_in_time) return { success: false, error: "Chưa check-in, không thể check-out" };
  if (existing.check_out_time) return { success: false, error: "Hôm nay đã check-out rồi" };

  let reportReminder = false;
  if (!isAdminLike(role)) {
    const { data: report } = await sb.from("daily_reports")
      .select("id, status")
      .eq("user_id", userId)
      .eq("report_date", dateStr)
      .maybeSingle();
    reportReminder = !report || report.status === "draft";
  }

  const flexHoursOut = isFlexibleHours(contractType);
  const earlyMin = flexHoursOut ? 0 : calcEarlyLeaveMinutes(now);

  let photoUrl: string | null = null;
  if (payload.photo) {
    photoUrl = await uploadAttendancePhoto(userId, "out", payload.photo);
  }

  const updates: any = {
    check_out_time: now,
    check_out_lat: payload.lat,
    check_out_lng: payload.lng,
    early_leave_minutes: earlyMin,
    status: earlyMin > 0 ? "early_leave" : (existing.status || "normal")
  };
  if (photoUrl) updates.check_out_photo_url = photoUrl;

  const { error } = await sb.from("attendance").update(updates).eq("id", existing.id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/cham-cong");
  const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
  const locTag = workLocation === "remote" ? " (remote)" : "";
  const remindMsg = reportReminder ? " · Nhớ nộp Báo cáo cuối ngày nhé!" : "";
  return {
    success: true,
    time: timeStr,
    earlyMinutes: earlyMin,
    photoUploaded: !!photoUrl,
    workLocation,
    reportReminder,
    message: (earlyMin > 0 ? `Check-out lúc ${timeStr}${locTag} — về sớm ${earlyMin} phút` : `Check-out lúc ${timeStr}${locTag} — đủ giờ`) + remindMsg
  };
}

export async function getMyAttendance(monthStr: string) {
  const userId = await getAuthUserId();
  if (!userId) return [];

  const sb = getServiceClient();
  const { start, nextStart } = monthRange(monthStr);
  const { data } = await sb.from("attendance")
    .select("*")
    .eq("user_id", userId)
    .gte("date", start)
    .lt("date", nextStart)
    .order("date", { ascending: false });

  return data ?? [];
}

export async function getWorkHoursConfig() {
  return WORK_HOURS;
}

export async function getOfficeLocation() {
  const userId = await getAuthUserId();
  if (!userId) return OFFICE_LOCATION;
  return vanPhongCua((await getUserAuthMeta(userId)).email);
}

export async function getMyApprovedLeavesForMonth(month: string): Promise<Array<{ from_date: string; to_date: string; type: string; days: number }>> {
  const userId = await getAuthUserId();
  if (!userId) return [];
  const sb = getServiceClient();

  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const endMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const { data } = await sb.from("leaves")
    .select("from_date, to_date, type, days")
    .eq("user_id", userId)
    .eq("status", "approved")
    .or(`and(from_date.gte.${start},from_date.lt.${endMonth}),and(to_date.gte.${start},to_date.lt.${endMonth})`);
  return data ?? [];
}

export async function getMyWorkMode(): Promise<WorkMode> {
  const userId = await getAuthUserId();
  if (!userId) return "office";
  return getUserWorkMode(userId);
}

export async function getMyAuthMeta(): Promise<{ workMode: WorkMode; role: string; contractType: string; canBypassGps: boolean; isFlexibleHours: boolean }> {
  const userId = await getAuthUserId();
  if (!userId) return { workMode: "office", role: "employee", contractType: "Chính thức", canBypassGps: false, isFlexibleHours: false };
  const meta = await getUserAuthMeta(userId);
  return {
    ...meta,
    canBypassGps: isAdminLike(meta.role),
    isFlexibleHours: isFlexibleHours(meta.contractType),
  };
}

export async function getMyDailyReportStatusToday(): Promise<{ submitted: boolean; status: string | null; canBypass: boolean }> {
  const userId = await getAuthUserId();
  if (!userId) return { submitted: false, status: null, canBypass: false };
  const sb = getServiceClient();
  const dateStr = vnDateStr();
  const [{ data: report }, meta] = await Promise.all([
    sb.from("daily_reports")
      .select("status")
      .eq("user_id", userId)
      .eq("report_date", dateStr)
      .maybeSingle(),
    getUserAuthMeta(userId),
  ]);
  return {
    submitted: !!report && report.status !== "draft",
    status: report?.status ?? null,
    canBypass: isAdminLike(meta.role),
  };
}

export async function submitCorrectionRequest(input: {
  attendance_date: string;
  request_type: "missed_checkin" | "missed_checkout" | "wrong_time" | "other";
  requested_check_in?: string;
  requested_check_out?: string;
  reason: string;
}) {
  const userId = await getAuthUserId();
  if (!userId) return { success: false, error: "Chưa đăng nhập" };
  if (!input.reason || input.reason.trim().length < 5)
    return { success: false, error: "Vui lòng mô tả lý do (≥5 ký tự)" };

  const sb = getServiceClient();
  const toIso = (date: string, time?: string) =>
    time ? new Date(`${date}T${time}:00+07:00`).toISOString() : null;

  const { error } = await sb.from("attendance_correction_requests").insert({
    user_id: userId,
    attendance_date: input.attendance_date,
    request_type: input.request_type,
    requested_check_in: toIso(input.attendance_date, input.requested_check_in),
    requested_check_out: toIso(input.attendance_date, input.requested_check_out),
    reason: input.reason
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/cham-cong");
  return { success: true };
}

export async function getMyCorrectionRequests() {
  const userId = await getAuthUserId();
  if (!userId) return [];
  const sb = getServiceClient();
  const { data } = await sb.from("attendance_correction_requests")
    .select("*, users!attendance_correction_requests_reviewed_by_fkey(full_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function getMyShiftsToday() {
  const userId = await getAuthUserId();
  if (!userId) return { shifts: [] as any[], ready: true };
  const sb = getServiceClient();
  const dateStr = vnDateStr();
  const { data, error } = await sb.from("part_time_shifts")
    .select("id, check_in_time, check_out_time, note")
    .eq("user_id", userId).eq("date", dateStr).order("check_in_time");
  if (error) return { shifts: [], ready: false };
  return { shifts: data ?? [], ready: true };
}

export async function getMyShiftsForMonth(monthStr: string) {
  const userId = await getAuthUserId();
  if (!userId) return { shifts: [] as any[], ready: true };
  const sb = getServiceClient();

  const [y, m] = monthStr.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const { data, error } = await sb.from("part_time_shifts")
    .select("id, date, check_in_time, check_out_time, note")
    .eq("user_id", userId).gte("date", `${monthStr}-01`).lt("date", nextMonth)
    .order("date").order("check_in_time");
  if (error) return { shifts: [], ready: false };
  return { shifts: data ?? [], ready: true };
}

export async function startShift(payload?: { photo?: string }) {
  const userId = await getAuthUserId();
  if (!userId) return { success: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const dateStr = vnDateStr();
  const { data: open } = await sb.from("part_time_shifts")
    .select("id").eq("user_id", userId).eq("date", dateStr).is("check_out_time", null).maybeSingle();
  if (open) return { success: false, error: "Đang có ca chưa kết thúc — kết thúc ca trước đã" };
  let photoUrl: string | null = null;
  if (payload?.photo) photoUrl = await uploadAttendancePhoto(userId, "in", payload.photo);
  const row: any = { user_id: userId, date: dateStr, check_in_time: new Date().toISOString() };
  if (photoUrl) { const { error: pe } = await sb.from("part_time_shifts").select("check_in_photo_url").limit(1); if (!pe) row.check_in_photo_url = photoUrl; }
  const { error } = await sb.from("part_time_shifts").insert(row);
  if (error) return { success: false, error: error.message };
  revalidatePath("/cham-cong");
  return { success: true };
}

export async function endShift() {
  const userId = await getAuthUserId();
  if (!userId) return { success: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const dateStr = vnDateStr();
  const { data: open } = await sb.from("part_time_shifts")
    .select("id, check_in_time").eq("user_id", userId).eq("date", dateStr).is("check_out_time", null).order("check_in_time", { ascending: false }).maybeSingle();
  if (!open) return { success: false, error: "Không có ca nào đang mở" };
  const { error } = await sb.from("part_time_shifts").update({ check_out_time: new Date().toISOString() }).eq("id", open.id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/cham-cong");
  return { success: true };
}
