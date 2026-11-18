import { getServerClient, getServiceClient } from "./supabase-server";
import { BOD_EMAILS, ACCOUNTANT_EMAILS } from "@/lib/auth";

export type AttendanceReminderStatus = {
  needsCheckIn: boolean;
  needsCheckOut: boolean;
  needsDailyReport: boolean;
  unclosedDaysCount: number;
  unclosedDays: string[];
  todayCheckedIn: boolean;
  todayCheckedOut: boolean;
  todayReportSubmitted: boolean;
  currentVnHour: number;
  currentVnMinute: number;
};

const REMIND_CI_HOUR = 8;
const REMIND_CI_MIN = 30;
const REMIND_REPORT_HOUR = 16;
const REMIND_REPORT_MIN = 30;
const REMIND_CO_HOUR = 17;
const REMIND_CO_MIN = 30;

function getVnNow() {
  const utcMs = Date.now();
  const vnDate = new Date(utcMs + 7 * 3600 * 1000);
  return {
    dateStr: vnDate.toISOString().slice(0, 10),
    hour: vnDate.getUTCHours(),
    minute: vnDate.getUTCMinutes(),
    dayOfWeek: vnDate.getUTCDay(),
  };
}

export async function getMyAttendanceReminderStatus(): Promise<AttendanceReminderStatus | null> {
  try {
    const auth = getServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return null;

    const NO_ATTENDANCE = [...BOD_EMAILS, ...ACCOUNTANT_EMAILS];
    if (NO_ATTENDANCE.includes((user.email || "").toLowerCase().trim())) return null;

    const sb = getServiceClient();
    const { hour, minute, dateStr, dayOfWeek } = getVnNow();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return null;
    }

    const { data: profile } = await sb.from("users")
      .select("active, contract_type, work_mode")
      .eq("id", user.id).maybeSingle();
    if (!profile || !profile.active) return null;
    if (profile.contract_type === "HĐ CTV") return null;

    const isFlexible = profile.contract_type === "Part-time" || profile.contract_type === "Khoán việc";

    const { data: leaveToday } = await sb.from("leaves")
      .select("id, type")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .lte("from_date", dateStr)
      .gte("to_date", dateStr)
      .limit(1);
    if (leaveToday && leaveToday.length > 0) {

      return null;
    }

    const [{ data: todayAtt }, { data: todayReport }] = await Promise.all([
      sb.from("attendance")
        .select("check_in_time, check_out_time")
        .eq("user_id", user.id)
        .eq("date", dateStr)
        .maybeSingle(),
      sb.from("daily_reports")
        .select("status")
        .eq("user_id", user.id)
        .eq("report_date", dateStr)
        .maybeSingle(),
    ]);

    const todayCheckedIn = !!todayAtt?.check_in_time;
    const todayCheckedOut = !!todayAtt?.check_out_time;
    const todayReportSubmitted = !!todayReport && todayReport.status !== "draft";

    const afterCiReminder = hour > REMIND_CI_HOUR || (hour === REMIND_CI_HOUR && minute >= REMIND_CI_MIN);
    const needsCheckIn = !isFlexible && afterCiReminder && !todayCheckedIn;

    const afterReportReminder = hour > REMIND_REPORT_HOUR || (hour === REMIND_REPORT_HOUR && minute >= REMIND_REPORT_MIN);
    const needsDailyReport = afterReportReminder && todayCheckedIn && !todayReportSubmitted && !todayCheckedOut;

    const afterCoReminder = hour > REMIND_CO_HOUR || (hour === REMIND_CO_HOUR && minute >= REMIND_CO_MIN);
    const needsCheckOut = !isFlexible && afterCoReminder && todayCheckedIn && !todayCheckedOut;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);
    const { data: unclosed } = await sb.from("attendance")
      .select("date, check_in_time, check_out_time")
      .eq("user_id", user.id)
      .gte("date", thirtyDaysAgo)
      .lt("date", dateStr)
      .order("date", { ascending: false });

    const unclosedDays = (unclosed ?? [])
      .filter((a: any) => a.check_in_time && !a.check_out_time)
      .map((a: any) => a.date);

    return {
      needsCheckIn,
      needsCheckOut,
      needsDailyReport,
      unclosedDaysCount: unclosedDays.length,
      unclosedDays: unclosedDays.slice(0, 3),
      todayCheckedIn,
      todayCheckedOut,
      todayReportSubmitted,
      currentVnHour: hour,
      currentVnMinute: minute,
    };
  } catch {
    return null;
  }
}
