"use client";
import { useEffect, useState, useTransition } from "react";
import { MapPin, LogIn, LogOut, CheckCircle2, AlertTriangle, Clock, ScanFace, MapPinOff, Navigation, Home } from "lucide-react";
import { checkIn, checkOut, getMyAttendance, getMyAuthMeta, getMyApprovedLeavesForMonth, getMyDailyReportStatusToday, getMyShiftsToday, getMyShiftsForMonth, getOfficeLocation, startShift, endShift } from "./actions";
import { FaceScanner } from "@/components/face-scanner";
import { CorrectionRequestButton } from "./correction-modal";
import { vnDateStr, fmtTimeVN } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

type WorkMode = "office" | "remote" | "hybrid";

const OFFICE_MAC_DINH = {
  lat: 20.9401072,
  lng: 106.3337713,
  radiusMeters: 400,
  accuracyTolerance: 300,
  name: "Văn phòng 40A Quang Trung",
  address: "Số 1 Đường Mẫu, Phường Mẫu, Thành phố Mẫu",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=20.9401072,106.3337713"
};

function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

type Att = {
  id: string; date: string;
  check_in_time: string | null; check_out_time: string | null;
  check_in_lat: number | null; check_in_lng: number | null;
  check_in_photo_url: string | null; check_out_photo_url: string | null;
  note: string | null;
  late_minutes: number | null; early_leave_minutes: number | null; status: string | null;
  work_location: string | null;
};

type ApprovedLeave = { from_date: string; to_date: string; type: string; days: number };

const LEAVE_TYPE_LABEL: Record<string, string> = {
  phep: "Nghỉ phép",
  om: "Nghỉ ốm",
  khong_luong: "Không lương",
  ot: "OT bù",
  cong_tac: "Công tác",
  hieu_hi: "Hiếu hỉ",
  ra_ngoai: "Ra ngoài",
};

type CalRow =
  | { kind: "attended"; date: string; dayOfWeek: number; data: Att }
  | { kind: "absent"; date: string; dayOfWeek: number }
  | { kind: "leave"; date: string; dayOfWeek: number; leaveType: string }
  | { kind: "weekend"; date: string; dayOfWeek: number }
  | { kind: "future"; date: string; dayOfWeek: number };

function buildMonthCalendar(month: string, attendance: Att[], leaves: ApprovedLeave[], todayStr: string): CalRow[] {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const attByDate: Record<string, Att> = Object.fromEntries(attendance.map(a => [a.date, a]));

  const leaveByDate: Record<string, string> = {};
  for (const lv of leaves) {

    const start = new Date(lv.from_date + "T00:00:00Z").getTime();
    const end = new Date(lv.to_date + "T00:00:00Z").getTime();
    for (let t = start; t <= end; t += 86400 * 1000) {
      const d = new Date(t).toISOString().slice(0, 10);
      leaveByDate[d] = lv.type;
    }
  }

  const rows: CalRow[] = [];
  for (let day = daysInMonth; day >= 1; day--) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const dow = new Date(date + "T00:00:00").getDay();
    const att = attByDate[date];
    if (att) rows.push({ kind: "attended", date, dayOfWeek: dow, data: att });
    else if (leaveByDate[date]) rows.push({ kind: "leave", date, dayOfWeek: dow, leaveType: leaveByDate[date] });
    else if (dow === 0 || dow === 6) rows.push({ kind: "weekend", date, dayOfWeek: dow });
    else if (date > todayStr) rows.push({ kind: "future", date, dayOfWeek: dow });
    else rows.push({ kind: "absent", date, dayOfWeek: dow });
  }
  return rows;
}

function shiftsToAtt(shifts: Array<{ date: string; check_in_time: string; check_out_time: string | null; note: string | null }>): Att[] {
  const byDate: Record<string, typeof shifts> = {};
  for (const s of shifts) (byDate[s.date] ||= []).push(s);
  return Object.entries(byDate).map(([date, arr]) => {
    arr.sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
    const closed = arr.filter(x => x.check_out_time);
    const co = closed.length ? closed[closed.length - 1].check_out_time : null;
    let mins = 0;
    for (const x of arr) if (x.check_out_time) mins += (new Date(x.check_out_time).getTime() - new Date(x.check_in_time).getTime()) / 60000;
    const h = mins / 60;
    return {
      id: date, date, check_in_time: arr[0].check_in_time, check_out_time: co,
      check_in_lat: null, check_in_lng: null, check_in_photo_url: null, check_out_photo_url: null,
      note: `${arr.length} ca · ${h.toFixed(1).replace(/\.0$/, "")}h`,
      late_minutes: 0, early_leave_minutes: 0, status: "present", work_location: null,
    } as Att;
  });
}

const DOW_LABEL = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function ChamCongPage() {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [list, setList] = useState<Att[]>([]);
  const [leaves, setLeaves] = useState<ApprovedLeave[]>([]);
  const [today, setToday] = useState<Att | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string>("");
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" | "warn" } | null>(null);
  const [scanMode, setScanMode] = useState<"in" | "out" | "shift" | null>(null);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode>("office");
  const [canBypassGps, setCanBypassGps] = useState<boolean>(false);
  const [isFlexibleHours, setIsFlexibleHours] = useState<boolean>(false);
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);
  const [shifts, setShifts] = useState<any[]>([]);
  const [pending, startTransition] = useTransition();

  const [OFFICE, setOffice] = useState(OFFICE_MAC_DINH);
  const dateStr = vnDateStr();

  const load = () => {
    const month = dateStr.slice(0, 7);
    startTransition(async () => {
      const [data, meta, lv, reportStatus, sh, shMonth] = await Promise.all([
        getMyAttendance(month),
        getMyAuthMeta(),
        getMyApprovedLeavesForMonth(month),
        getMyDailyReportStatusToday(),
        getMyShiftsToday(),
        getMyShiftsForMonth(month),
      ]);
      getOfficeLocation().then(setOffice).catch(() => {});

      const monthShifts = (shMonth as any).shifts ?? [];
      const effectiveList = meta.isFlexibleHours ? shiftsToAtt(monthShifts) : (data as Att[]);
      setList(effectiveList);
      setLeaves(lv as ApprovedLeave[]);
      setToday(effectiveList.find(a => a.date === dateStr) ?? null);
      setWorkMode(meta.workMode as WorkMode);
      setCanBypassGps(!!meta.canBypassGps);
      setIsFlexibleHours(!!meta.isFlexibleHours);
      setReportSubmitted(!!reportStatus.submitted);
      setShifts((sh as any).shifts ?? []);
    });
  };

  useEffect(() => {
    load();
    if (navigator.geolocation) {

      const id = navigator.geolocation.watchPosition(
        p => {
          setGps({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
          setGpsError("");
        },
        err => setGpsError(err.message || "Không truy cập được GPS"),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const distToOffice = gps ? distance(gps.lat, gps.lng, OFFICE.lat, OFFICE.lng) : null;
  const accTolerance = Math.min((gps?.accuracy ?? 0) / 2, OFFICE.accuracyTolerance);
  const effectiveRadius = OFFICE.radiusMeters + accTolerance;
  const isInOffice = distToOffice !== null && distToOffice <= effectiveRadius;
  const distLabel = distToOffice === null ? null
    : distToOffice >= 1000 ? `${(distToOffice / 1000).toFixed(1)} km`
    : `${distToOffice}m`;

  const isRemote = workMode === "remote";
  const isHybrid = workMode === "hybrid";

  const gpsFailed = !!gpsError && !gps;
  const canCheckIn = canBypassGps || (workMode === "office" ? (isInOffice || gpsFailed) : true);

  const onFaceCaptured = (photo: string) => {
    const mode = scanMode;
    setScanMode(null);
    if (mode === "shift") {
      startTransition(async () => {
        const res = await startShift({ photo });
        setMsg(res.success ? { text: t("Đã bắt đầu ca (đã chấm face)"), type: "ok" } : { text: "" + res.error, type: "err" });
        load(); setTimeout(() => setMsg(null), 4000);
      });
      return;
    }
    const isCheckIn = mode === "in";
    startTransition(async () => {
      const res = isCheckIn
        ? await checkIn({ lat: gps?.lat ?? null, lng: gps?.lng ?? null, accuracy: gps?.accuracy ?? null, photo })
        : await checkOut({ lat: gps?.lat ?? null, lng: gps?.lng ?? null, accuracy: gps?.accuracy ?? null, photo });
      if (res.success) {
        const lateOrEarly = (res as any).lateMinutes > 0 || (res as any).earlyMinutes > 0;
        setMsg({ text: "" + (res as any).message, type: lateOrEarly ? "warn" : "ok" });
        load();
      } else if ((res as any).requireDailyReport) {

        setMsg({ text: "" + res.error + t(" — Đang chuyển hướng..."), type: "warn" });
        setTimeout(() => { window.location.href = "/daily-report?return=cham-cong"; }, 1500);
      } else {
        setMsg({ text: "" + res.error, type: "err" });
      }
      setTimeout(() => setMsg(null), 5000);
    });
  };

  const quickCheckOut = () => {
    startTransition(async () => {
      const res = await checkOut({ lat: gps?.lat ?? null, lng: gps?.lng ?? null, accuracy: gps?.accuracy ?? null });
      if (res.success) {
        const early = (res as any).earlyMinutes > 0;
        setMsg({ text: "" + (res as any).message, type: early ? "warn" : "ok" });
        load();
      } else {
        setMsg({ text: "" + res.error, type: "err" });
      }
      setTimeout(() => setMsg(null), 5000);
    });
  };

  const openShift = shifts.find(s => !s.check_out_time);
  const doEndShift = () => startTransition(async () => {
    const res = await endShift();
    setMsg(res.success ? { text: t("Đã kết thúc ca"), type: "ok" } : { text: "" + res.error, type: "err" });
    load(); setTimeout(() => setMsg(null), 4000);
  });
  const shiftHours = shifts.reduce((s, x) => s + (x.check_in_time && x.check_out_time ? (new Date(x.check_out_time).getTime() - new Date(x.check_in_time).getTime()) / 3600000 : 0), 0);

  const fmt = (t: string | null) => fmtTimeVN(t);

  const totalLate = list.reduce((s, a) => s + (a.late_minutes || 0), 0);
  const totalEarly = list.reduce((s, a) => s + (a.early_leave_minutes || 0), 0);

  const unclosedDays = list.filter(a =>
    a.date !== dateStr &&
    a.check_in_time && !a.check_out_time
  );

  const calendar = buildMonthCalendar(dateStr.slice(0, 7), list, leaves, dateStr);

  const totalAttended = calendar.filter(r => r.kind === "attended").length;
  const totalAbsent = calendar.filter(r => r.kind === "absent").length;
  const totalLeaveDays = calendar.filter(r => r.kind === "leave").length;
  const totalWorkdays = calendar.filter(r => r.kind === "attended" || r.kind === "absent" || r.kind === "leave").length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <ScanFace className="w-6 h-6 text-brand-600" /> {t("Chấm công Face ID")}
        </h1>
        <CorrectionRequestButton defaultDate={dateStr} />
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
        <div>
          <b className="text-orange-800">{t("Lưu ý quy định:")}</b>
          <span className="text-orange-700"> {t("Quên check-in / check-out Face ID sẽ bị phạt")} <b>{tDich("50.000đ/lần")}</b>.
          {t("Nếu quên do lý do hợp lệ, vui lòng bấm")} <b>"{t("Xin sửa chấm công")}"</b> {t("ở góc phải để xin admin duyệt — sẽ được miễn phạt.")}</span>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm flex items-center gap-2">
        <Clock className="w-4 h-4 text-blue-600" />
        <span>{t("Giờ làm chuẩn ACME:")} <b>08:00 – 12:00</b> · {t("nghỉ trưa")} · <b>13:30 – 17:30</b> {t("(8h/ngày, grace 5 phút)")}</span>
      </div>

      {unclosedDays.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <b className="text-amber-800">⏰ {t("Bạn có")} {unclosedDays.length} {t("ngày chưa check-out:")}</b>
              <div className="mt-1 text-amber-700 text-xs flex flex-wrap gap-2 items-center">
                {unclosedDays.slice(0, 5).map(d => (
                  <span key={d.id} className="bg-white border border-amber-200 px-2 py-0.5 rounded tabular-nums">
                    {d.date} · {t("vào")} {fmt(d.check_in_time)}
                  </span>
                ))}
                {unclosedDays.length > 5 && <span className="text-amber-600">+{unclosedDays.length - 5}</span>}
              </div>
              <div className="mt-2 text-xs text-amber-700">
                {t("Việc này")} <b>{t("KHÔNG block")}</b> {t("check-in hôm nay. Bấm")} <b>"{t("Xin sửa chấm công")}"</b> {t("ở góc phải để admin duyệt thời gian check-out các ngày trên.")}
              </div>
            </div>
            <CorrectionRequestButton defaultDate={unclosedDays[0]?.date} />
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-[#0B1F14] to-[#143020] rounded-2xl p-5 sm:p-8 text-center text-white">
        <div className="text-sm text-gray-400 mb-2">{t("Hôm nay")} {dateStr}</div>
        <div className="text-2xl sm:text-3xl font-bold mb-2">
          {t("Vào:")} <span className="text-[#F5C518]">{fmt(today?.check_in_time ?? null)}</span>
          <span className="text-gray-500 mx-2 sm:mx-3">·</span>
          {t("Ra:")} <span className="text-orange-400">{fmt(today?.check_out_time ?? null)}</span>
        </div>

        {today && (today.late_minutes! > 0 || today.early_leave_minutes! > 0) && (
          <div className="text-sm text-yellow-300 bg-yellow-500/10 inline-block px-3 py-1 rounded-full mb-3 mt-2">

            {today.late_minutes! > 0 && ` ${t("Đi muộn")} ${today.late_minutes} ${t("phút")}`}
            {today.late_minutes! > 0 && today.early_leave_minutes! > 0 && " · "}
            {today.early_leave_minutes! > 0 && ` ${t("Về sớm")} ${today.early_leave_minutes} ${t("phút")}`}
          </div>
        )}

        {today && (today.check_in_photo_url || today.check_out_photo_url) && (
          <div className="flex justify-center gap-3 my-4">
            {today.check_in_photo_url && (
              <div className="text-center cursor-pointer" onClick={() => setPhotoModal(today.check_in_photo_url)}>
                <img src={today.check_in_photo_url} alt="Check-in" className="w-16 h-16 rounded-full border-2 border-[#F5C518] object-cover" />
                <div className="text-xs text-gray-400 mt-1">{t("Vào")}</div>
              </div>
            )}
            {today.check_out_photo_url && (
              <div className="text-center cursor-pointer" onClick={() => setPhotoModal(today.check_out_photo_url)}>
                <img src={today.check_out_photo_url} alt="Check-out" className="w-16 h-16 rounded-full border-2 border-orange-400 object-cover" />
                <div className="text-xs text-gray-400 mt-1">{t("Ra")}</div>
              </div>
            )}
          </div>
        )}

        {isFlexibleHours && (
          <div className="mt-3 mx-auto max-w-md bg-white/10 border border-white/20 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">{t("⏱Ca làm hôm nay")}</span>
              <span className="text-xs text-[#F5C518]">{shiftHours > 0 ? `${(Math.round(shiftHours * 100) / 100)} ${t("giờ")}` : t("0 giờ")}</span>
            </div>
            <div className="space-y-1 mb-3">
              {shifts.length === 0 && <div className="text-xs text-white/50">{t("Chưa có ca nào hôm nay")}</div>}
              {shifts.map((s, i) => (
                <div key={s.id} className="flex justify-between text-xs bg-white/5 rounded px-2 py-1">
                  <span>{t("Ca")} {i + 1}: {fmtTimeVN(s.check_in_time)} → {s.check_out_time ? fmtTimeVN(s.check_out_time) : <span className="text-emerald-300">{t("đang làm…")}</span>}</span>
                  {s.check_in_time && s.check_out_time && <span className="text-white/60">{Math.round((new Date(s.check_out_time).getTime() - new Date(s.check_in_time).getTime()) / 36000) / 100}h</span>}
                </div>
              ))}
            </div>
            {openShift
              ? <button onClick={doEndShift} disabled={pending} className="w-full py-3 bg-orange-500 text-white rounded-md font-bold disabled:opacity-50 flex items-center justify-center gap-2"><ScanFace className="w-5 h-5" /> {t("⏹ KẾT THÚC CA")}</button>
              : <button onClick={() => setScanMode("shift")} disabled={pending} className="w-full py-3 bg-[#F5C518] text-[#0B1F14] rounded-md font-bold disabled:opacity-50 flex items-center justify-center gap-2"><ScanFace className="w-5 h-5" /> {t("▶BẮT ĐẦU CA — SCAN FACE")}</button>}
            <p className="text-[11px] text-white/50 mt-2">{t("Part-time tính lương theo GIỜ — bấm Bắt đầu/Kết thúc mỗi ca, 1 ngày làm 2–3 ca đều được.")}</p>
          </div>
        )}

        <div className={`flex flex-col sm:flex-row gap-3 sm:justify-center mt-3 ${isFlexibleHours ? "hidden" : ""}`}>
          <button onClick={() => setScanMode("in")} disabled={pending || !!today?.check_in_time || !canCheckIn}
            className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-[#F5C518] text-[#0B1F14] rounded-md font-bold hover:bg-[#FFD93D] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg">
            <ScanFace className="w-5 h-5" /> {today?.check_in_time ? t("✓ ĐÃ CHECK-IN") : t("SCAN FACE — CHECK-IN")}
          </button>
          <button
            onClick={() => setScanMode("out")}
            disabled={pending || !today?.check_in_time || !!today?.check_out_time}
            className="w-full sm:w-auto px-6 py-3.5 sm:py-3 rounded-md font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg bg-orange-500 text-white hover:bg-orange-600"
          >
            <ScanFace className="w-5 h-5" />
            {today?.check_out_time ? t("✓ ĐÃ CHECK-OUT") : t("SCAN FACE — CHECK-OUT")}
          </button>
        </div>

        {gpsFailed && !today?.check_in_time && workMode === "office" && !canBypassGps && (
          <div className="mt-3 mx-auto max-w-md bg-amber-500/15 border border-amber-400/30 text-amber-100 rounded-lg p-3 text-xs">
            {t("Không lấy được GPS — bạn")} <b>{t("vẫn check-in được")}</b>, {t("nhưng sẽ được đánh dấu")} <b>"{t("chờ admin xác minh vị trí")}"</b>.
          </div>
        )}

        {today?.check_in_time && !today?.check_out_time && (
          <div className="text-center mt-2">
            <button onClick={quickCheckOut} disabled={pending}
              className="text-sm text-orange-300 underline underline-offset-2 hover:text-orange-200 disabled:opacity-40">
              {t("⏱Check-out nhanh (không cần quét mặt)")}
            </button>
          </div>
        )}

        {today?.check_in_time && !today?.check_out_time && !reportSubmitted && !canBypassGps && (
          <div className="mt-3 mx-auto max-w-md bg-amber-500/15 border border-amber-400/30 text-amber-100 rounded-lg p-3 text-xs">
            {t("Bạn")} <b>{t("chưa nộp Báo cáo cuối ngày")}</b> {t("— vẫn check-out được, nhưng đừng quên nộp nhé.")}{" "}
            <a href="/daily-report?return=cham-cong" className="underline font-bold hover:text-white">{t("Nộp báo cáo →")}</a>
          </div>
        )}
        {today?.check_in_time && !today?.check_out_time && reportSubmitted && !canBypassGps && (
          <div className="mt-3 mx-auto max-w-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 rounded-lg p-2 text-xs">
            {t("✓ Đã nộp báo cáo cuối ngày — có thể check-out")}
          </div>
        )}

        <div className="mt-3 inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white">
          {isFlexibleHours ? (
            <><Clock className="w-3 h-3 text-[#F5C518]" /> {t("Chế độ")} <b>PART-TIME</b> {t("— giờ vào/ra tự do, KHÔNG tính phạt giờ")}</>
          ) : canBypassGps ? (
            <><CheckCircle2 className="w-3 h-3 text-[#F5C518]" /> {t("Chế độ")} <b>ADMIN</b> {t("— bypass GPS, chấm công mọi lúc")}</>
          ) : isRemote ? (
            <><Home className="w-3 h-3 text-emerald-300" /> {t("Chế độ")} <b>REMOTE</b> {t("— chấm công từ xa được phép")}</>
          ) : isHybrid ? (
            <><Navigation className="w-3 h-3 text-blue-300" /> {t("Chế độ")} <b>HYBRID</b> {t("— chấm công cả văn phòng + remote")}</>
          ) : (
            <><MapPin className="w-3 h-3 text-[#F5C518]" /> {t("Chế độ")} <b>OFFICE</b> {t("— phải ở văn phòng")}</>
          )}
        </div>

        <div className="mt-4">
          {gpsError && canBypassGps ? (

            <div className="bg-[#F5C518]/15 border border-[#F5C518]/30 text-[#F5C518] rounded-lg p-3 text-sm inline-block max-w-md">
              <MapPinOff className="w-4 h-4 inline mr-1" />
              {t("Admin bypass — GPS chưa cấp quyền nhưng vẫn cho chấm công.")}
            </div>
          ) : gpsError && (isRemote || isHybrid) ? (

            <div className="bg-amber-500/20 border border-amber-400/30 text-amber-100 rounded-lg p-3 text-sm inline-block max-w-md">
              <MapPinOff className="w-4 h-4 inline mr-1" />
              {t("GPS chưa cấp quyền — vẫn cho phép chấm công")} {isRemote ? "remote" : "hybrid"}.
              <div className="text-xs mt-1 opacity-80">{t('Bật "Cho phép Vị trí" trong Safari Settings → acmeops để log chính xác hơn.')}</div>
            </div>
          ) : gpsError ? (

            <div className="bg-red-500/20 border border-red-400/30 text-red-200 rounded-lg p-3 text-sm inline-block max-w-md">
              <MapPinOff className="w-4 h-4 inline mr-1" /> {gpsError}
              <div className="text-xs mt-2 text-red-100/80">
                {t("iPhone: Cài đặt → Safari → Vị trí → Cho phép. Sau đó tải lại trang.")}
              </div>
            </div>
          ) : !gps ? (
            <div className="text-sm text-gray-400 flex items-center justify-center gap-2">
              <MapPin className="w-4 h-4 animate-pulse" /> {t("Đang xác định vị trí GPS...")}
            </div>
          ) : isRemote ? (

            <div className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 rounded-lg p-3 text-sm inline-block">
              <Home className="w-4 h-4 inline mr-1" />
              {t("✓ Chấm công")} <b>remote</b> {t("— cách văn phòng")} {distLabel}
            </div>
          ) : isHybrid ? (

            <div className={`${isInOffice ? "bg-green-500/20 border-green-400/30 text-green-300" : "bg-blue-500/20 border-blue-400/30 text-blue-200"} border rounded-lg p-3 text-sm inline-block`}>
              {isInOffice ? <CheckCircle2 className="w-4 h-4 inline mr-1" /> : <Home className="w-4 h-4 inline mr-1" />}
              {isInOffice
                ? <>{t("✓ Đang ở")} <b>{OFFICE.name}</b> ({t("cách")} {distLabel})</>
                : <>{t("✓ Chấm công")} <b>{t("remote/ngoại tuyến")}</b> {t("— cách văn phòng")} {distLabel}</>}
            </div>
          ) : isInOffice ? (
            <div className="bg-green-500/20 border border-green-400/30 text-green-300 rounded-lg p-3 text-sm inline-block">
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              {t("✓ Đang ở")} <b>{OFFICE.name}</b> ({t("cách")} {distLabel})
            </div>
          ) : (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 rounded-lg p-3 text-sm max-w-md mx-auto">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              <b>{t("Bạn cách văn phòng")} {distLabel}</b> {t("— chưa thể chấm công.")}<br/>
              <span className="text-xs">{t("Phải đến trong bán kính")} {OFFICE.radiusMeters}m {t("của")} {OFFICE.name}.</span>
              <div className="mt-2">
                <a href={OFFICE.mapsUrl} target="_blank" rel="noopener" className="text-xs underline inline-flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> {t("Xem chỉ đường đến văn phòng")}
                </a>
              </div>
              <div className="mt-2 text-xs text-red-100/80">
                {t("Nếu bạn làm")} <b>remote</b>, {t("nhờ admin chuyển")} <code>work_mode = "remote"</code> {t("trong hồ sơ nhân sự")}
              </div>
            </div>
          )}
          {gps && (
            <div className="text-xs text-gray-500 mt-2">
              GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}{gps.accuracy ? ` · ${t("độ chính xác ±")}${Math.round(gps.accuracy)}m` : ""}
            </div>
          )}
        </div>

        {msg && (
          <div className={`mt-3 text-sm font-medium px-3 py-2 inline-block rounded-lg ${
            msg.type === "ok" ? "bg-green-500/20 text-green-300" :
            msg.type === "warn" ? "bg-yellow-500/20 text-yellow-200" :
            "bg-red-500/20 text-red-300"
          }`}>{msg.text}</div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500 uppercase">{t("NC tháng")}</div>
          <div className="text-xl font-bold mt-1 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-brand-600" />
            {totalAttended}/{totalWorkdays}
          </div>
        </div>
        <div className={`border rounded-lg p-3 text-center ${totalAbsent > 0 ? "bg-red-50 border-red-300" : "bg-white border-gray-200"}`}>
          <div className="text-xs text-gray-500 uppercase">{t("Không chấm")}</div>
          <div className={`text-xl font-bold mt-1 ${totalAbsent > 0 ? "text-red-600" : "text-gray-400"}`}>{totalAbsent} {t("ngày")}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500 uppercase">{t("Nghỉ phép")}</div>
          <div className={`text-xl font-bold mt-1 ${totalLeaveDays > 0 ? "text-blue-700" : "text-gray-400"}`}>{totalLeaveDays} {t("ngày")}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500 uppercase">{t("Đi muộn")}</div>
          <div className={`text-xl font-bold mt-1 ${totalLate > 0 ? "text-red-600" : ""}`}>{totalLate} {t("phút")}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500 uppercase">{t("Về sớm")}</div>
          <div className={`text-xl font-bold mt-1 ${totalEarly > 0 ? "text-red-600" : ""}`}>{totalEarly} {t("phút")}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold">{t("Lịch sử tháng này —")} {dateStr.slice(0, 7)}</h2>
          <div className="text-xs text-gray-500 flex gap-3 flex-wrap">
            <span><b className="text-green-600">●</b> {t("Đã chấm")}</span>
            <span><b className="text-red-600">●</b> {t("Không chấm")}</span>
            <span><b className="text-blue-600">●</b> {t("Nghỉ phép")}</span>
            <span><b className="text-gray-400">●</b> {t("Cuối tuần / chưa tới")}</span>
          </div>
        </div>
        <div className="sm:hidden divide-y divide-gray-100">
          {calendar.map(row => {
            const dowLabel = DOW_LABEL[row.dayOfWeek];
            const isToday = row.date === dateStr;
            const head = (
              <div className="flex items-center gap-2">
                <span className="font-semibold">{row.date.slice(8)}/{row.date.slice(5, 7)}</span>
                <span className="text-xs text-gray-400">{dowLabel}</span>
                {isToday && <span className="text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded">{t("HÔM NAY")}</span>}
              </div>
            );
            if (row.kind === "attended") {
              const a = row.data;
              const onTime = !(a.late_minutes! > 0 || a.early_leave_minutes! > 0);
              return (
                <div key={row.date} className={`p-3 ${isToday ? "bg-brand-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    {head}
                    {onTime
                      ? <span className="text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded">{t("Đúng giờ")}</span>
                      : <span className="text-[11px] text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">
                          {a.late_minutes! > 0 && `${t("muộn")} ${a.late_minutes}p`}{a.late_minutes! > 0 && a.early_leave_minutes! > 0 && " · "}{a.early_leave_minutes! > 0 && `${t("sớm")} ${a.early_leave_minutes}p`}
                        </span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-4 text-sm">
                    <span>{t("Vào")} <b>{fmt(a.check_in_time)}</b></span>
                    <span>{t("Ra")} <b>{fmt(a.check_out_time)}</b></span>
                    {!isFlexibleHours && (a.work_location === "remote"
                      ? <span className="text-[11px] text-emerald-700">Remote</span>
                      : <span className="text-[11px] text-blue-700">{t("VP")}</span>)}
                  </div>
                  {isFlexibleHours && tDich(a.note) && (
                    <div className="text-[11px] text-gray-500 mt-0.5">{tDich(a.note)}</div>
                  )}
                  {a.check_in_time && !a.check_out_time && !isToday && (
                    <div className="text-[11px] text-red-600 mt-1">{t('Quên check-out — bấm "Xin sửa chấm công" để bổ sung')}</div>
                  )}
                  {(a.check_in_photo_url || a.check_out_photo_url) && (
                    <div className="flex gap-1.5 mt-2">
                      {a.check_in_photo_url && <img src={a.check_in_photo_url} onClick={() => setPhotoModal(a.check_in_photo_url)} className="w-9 h-9 rounded-full border border-brand-200 object-cover" alt="in" />}
                      {a.check_out_photo_url && <img src={a.check_out_photo_url} onClick={() => setPhotoModal(a.check_out_photo_url)} className="w-9 h-9 rounded-full border border-orange-200 object-cover" alt="out" />}
                    </div>
                  )}
                </div>
              );
            }
            if (row.kind === "absent") {
              return (
                <div key={row.date} className="p-3 bg-red-50 flex items-center justify-between">
                  {head}<span className="text-[11px] text-red-700 bg-red-100 px-2 py-0.5 rounded font-semibold">{t("Không chấm công")}</span>
                </div>
              );
            }
            if (row.kind === "leave") {
              return (
                <div key={row.date} className="p-3 bg-blue-50 flex items-center justify-between">
                  {head}<span className="text-[11px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded font-semibold">{t(LEAVE_TYPE_LABEL[row.leaveType] || row.leaveType)}</span>
                </div>
              );
            }

            return (
              <div key={row.date} className="px-3 py-2 flex items-center justify-between text-gray-400">
                {head}<span className="text-xs italic">{row.kind === "weekend" ? t("Cuối tuần") : t("Chưa tới")}</span>
              </div>
            );
          })}
          {calendar.length === 0 && <div className="p-8 text-center text-gray-400">{t("Đang tải...")}</div>}
        </div>

        <table className="w-full text-sm hidden sm:table">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-3">{t("Ngày")}</th>
              <th className="text-left p-3">{t("Ảnh")}</th>
              <th className="text-left p-3">{t("Vào")}</th>
              <th className="text-left p-3">{t("Ra")}</th>
              <th className="text-left p-3">{t("Nơi")}</th>
              <th className="text-left p-3">{t("Trạng thái")}</th>
            </tr>
          </thead>
          <tbody>
            {calendar.map(row => {
              const dowLabel = DOW_LABEL[row.dayOfWeek];
              const isToday = row.date === dateStr;

              if (row.kind === "attended") {
                const a = row.data;
                return (
                  <tr key={row.date} className={`border-t border-gray-100 ${isToday ? "bg-brand-50" : ""}`}>
                    <td className="p-3 font-medium">
                      {row.date} <span className="text-xs text-gray-400">{dowLabel}</span>
                      {isToday && <span className="ml-1 text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded">{t("HÔM NAY")}</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {a.check_in_photo_url && (
                          <img src={a.check_in_photo_url} alt="In" onClick={() => setPhotoModal(a.check_in_photo_url)}
                            className="w-8 h-8 rounded-full border border-brand-200 object-cover cursor-pointer hover:scale-150 transition" />
                        )}
                        {a.check_out_photo_url && (
                          <img src={a.check_out_photo_url} alt="Out" onClick={() => setPhotoModal(a.check_out_photo_url)}
                            className="w-8 h-8 rounded-full border border-orange-200 object-cover cursor-pointer hover:scale-150 transition" />
                        )}
                        {!a.check_in_photo_url && !a.check_out_photo_url && <span className="text-xs text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="p-3">{fmt(a.check_in_time)}</td>
                    <td className="p-3">
                      {fmt(a.check_out_time)}
                      {a.check_in_time && !a.check_out_time && !isToday && (
                        <div className="text-[10px] text-red-600 mt-0.5">{t("Quên CO")}</div>
                      )}
                    </td>
                    <td className="p-3">
                      {a.work_location === "remote" ? (
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <Home className="w-3 h-3" /> Remote
                        </span>
                      ) : a.work_location === "office" || a.check_in_time ? (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {t("Văn phòng")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      {(a.late_minutes! > 0 || a.early_leave_minutes! > 0) ? (
                        <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          {a.late_minutes! > 0 && `${t("muộn")} ${a.late_minutes}p`}
                          {a.late_minutes! > 0 && a.early_leave_minutes! > 0 && " · "}
                          {a.early_leave_minutes! > 0 && `${t("sớm")} ${a.early_leave_minutes}p`}
                        </span>
                      ) : a.check_in_time ? (
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">{t("Đúng giờ")}</span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              }

              if (row.kind === "absent") {
                return (
                  <tr key={row.date} className="border-t border-gray-100 bg-red-50">
                    <td className="p-3 font-medium text-red-700">
                      {row.date} <span className="text-xs text-gray-400">{dowLabel}</span>
                    </td>
                    <td className="p-3 text-gray-300">—</td>
                    <td className="p-3 text-gray-300">—</td>
                    <td className="p-3 text-gray-300">—</td>
                    <td className="p-3 text-gray-300">—</td>
                    <td className="p-3">
                      <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded font-semibold">
                        {t("Không chấm công")}
                      </span>
                    </td>
                  </tr>
                );
              }

              if (row.kind === "leave") {
                return (
                  <tr key={row.date} className="border-t border-gray-100 bg-blue-50">
                    <td className="p-3 font-medium text-blue-700">
                      {row.date} <span className="text-xs text-gray-400">{dowLabel}</span>
                    </td>
                    <td className="p-3 text-gray-300">—</td>
                    <td className="p-3 text-gray-300">—</td>
                    <td className="p-3 text-gray-300">—</td>
                    <td className="p-3 text-gray-300">—</td>
                    <td className="p-3">
                      <span className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded font-semibold">
                        {t(LEAVE_TYPE_LABEL[row.leaveType] || row.leaveType)}
                      </span>
                    </td>
                  </tr>
                );
              }

              if (row.kind === "weekend") {
                return (
                  <tr key={row.date} className="border-t border-gray-100 bg-gray-50/50">
                    <td className="p-3 text-gray-400">
                      {row.date} <span className="text-xs">{dowLabel}</span>
                    </td>
                    <td colSpan={5} className="p-3 text-xs text-gray-400 italic">{t("Cuối tuần")}</td>
                  </tr>
                );
              }

              return (
                <tr key={row.date} className="border-t border-gray-100">
                  <td className="p-3 text-gray-300">
                    {row.date} <span className="text-xs">{dowLabel}</span>
                  </td>
                  <td colSpan={5} className="p-3 text-xs text-gray-300 italic">{t("Chưa tới")}</td>
                </tr>
              );
            })}
            {calendar.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">{t("Đang tải...")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {scanMode && (
        <FaceScanner mode={scanMode === "out" ? "check-out" : "check-in"}
          onCapture={onFaceCaptured} onCancel={() => setScanMode(null)} />
      )}

      {photoModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setPhotoModal(null)}>
          <img src={photoModal} alt="Zoom" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}
