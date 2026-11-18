"use client";
import { useState, useTransition, useMemo } from "react";
import { adminEditAttendance, reviewCorrectionRequest, runDailyAttendanceCheck } from "./actions";
import { fmtVND } from "@/lib/payroll";
import { Edit3, Check, X, AlertTriangle, RefreshCw, Save, CalendarCheck } from "lucide-react";
import { TodayClient } from "./today/client";
import { useLang } from "@/components/lang-provider";

export function AttendanceAdminClient({ attendance, requests, month, today, initialTab }: any) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [tab, setTab] = useState<"today" | "requests" | "edit" | "history">(
    (initialTab as any) || "today"
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const runDailyCheck = () => {
    startTransition(async () => {
      const res = await runDailyAttendanceCheck();
      if (res.success) {
        setMsg({ text: `${t("Đã chạy auto-check — phát hiện")} ${res.issuesFound} ${t("vấn đề")}`, type: "ok" });
      } else {
        setMsg({ text: t("Lỗi: ") + (res as any).error, type: "err" });
      }
      setTimeout(() => setMsg(null), 4000);
    });
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
      <div className="border-b border-gray-100 px-4 flex justify-between items-center">
        <div className="flex flex-wrap">
          {[
            { v: "today", l: `${t("Hôm nay")} (${today?.summary?.checkedIn ?? 0}/${today?.summary?.total ?? 0})` },
            { v: "requests", l: `${t("Đơn xin sửa")} (${requests.length})` },
            { v: "edit", l: t("Sửa chấm công tháng") },
            { v: "history", l: t("Lịch sử") }
          ].map(t => (
            <button key={t.v} onClick={() => setTab(t.v as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                tab === t.v ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"
              }`}>{t.l}</button>
          ))}
        </div>
        <button onClick={runDailyCheck} disabled={pending}
          className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${pending ? "animate-spin" : ""}`} /> {t("Auto-check quên CI/CO")}
        </button>
      </div>

      {msg && <div className={`m-4 p-3 rounded ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"} text-sm`}>{msg.text}</div>}

      {tab === "today" && today && (
        <div className="p-4">
          <TodayClient initial={today} />
        </div>
      )}
      {tab === "requests" && <RequestsTab requests={requests} />}
      {tab === "edit" && <EditTab attendance={attendance} />}
      {tab === "history" && <HistoryTab attendance={attendance} />}
    </div>
  );
}

function RequestsTab({ requests }: any) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const review = (id: string, approve: boolean, applyNow: boolean) => {
    startTransition(async () => {
      const res = await reviewCorrectionRequest({
        request_id: id, approve, apply_to_attendance: applyNow,
        review_note: note[id]
      });
      setMsg(res.success
        ? { text: approve ? t("Đã duyệt + áp dụng vào chấm công") : t("Đã từ chối đơn"), type: "ok" }
        : { text: "" + res.error, type: "err" });
      setTimeout(() => setMsg(null), 3000);
    });
  };

  if (requests.length === 0) {
    return <div className="p-12 text-center text-gray-400">{t("Không có đơn xin sửa nào đang chờ duyệt")}</div>;
  }

  return (
    <div className="p-4 space-y-3">
      {msg && <div className={`p-2 rounded ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"} text-sm`}>{msg.text}</div>}
      {requests.map((r: any) => (
        <div key={r.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start gap-3 mb-2">
            <div>
              <div className="font-bold">{r.users?.full_name} <span className="text-xs text-gray-500 font-normal">({r.users?.position})</span></div>
              <div className="text-xs text-gray-500 mt-0.5">
                {t("Ngày:")} <b>{r.attendance_date}</b> · {t("Loại:")} {r.request_type === "missed_checkin" ? t("Quên check-in") :
                  r.request_type === "missed_checkout" ? t("Quên check-out") :
                  r.request_type === "wrong_time" ? t("⏰ Sai giờ") : t("Khác")}
              </div>
              <div className="text-xs text-gray-500">
                {t("Yêu cầu: Vào")} {r.requested_check_in ? new Date(r.requested_check_in).toLocaleTimeString("vi-VN", {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"}) : "—"} · {t("Ra")} {r.requested_check_out ? new Date(r.requested_check_out).toLocaleTimeString("vi-VN", {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"}) : "—"}
              </div>
            </div>
            <div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString("vi-VN")}</div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-2 rounded text-sm mt-2">
            <b className="text-xs uppercase text-yellow-700">{t("Lý do NV:")}</b>
            <div>{r.reason}</div>
          </div>

          <input type="text" placeholder={t("Ghi chú khi duyệt (optional)")}
            value={note[r.id] || ""}
            onChange={e => setNote({...note, [r.id]: e.target.value})}
            className="mt-2 w-full p-2 border border-gray-200 rounded text-sm" />

          <div className="flex gap-2 mt-3">
            <button onClick={() => review(r.id, true, true)} disabled={pending}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50">
              <Check className="w-3 h-3" /> {t("Duyệt + Áp dụng + Miễn phạt")}
            </button>
            <button onClick={() => review(r.id, true, false)} disabled={pending}
              className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-semibold inline-flex items-center gap-1">
              <Check className="w-3 h-3" /> {t("Duyệt (ko sửa)")}
            </button>
            <button onClick={() => review(r.id, false, false)} disabled={pending}
              className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-semibold inline-flex items-center gap-1">
              <X className="w-3 h-3" /> {t("Từ chối")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EditTab({ attendance }: any) {
  const { t } = useLang();
  const [filter, setFilter] = useState<"all" | "issues">("all");
  const [userFilter, setUserFilter] = useState<string>("");

  const userSummary = useMemo(() => {
    const map: Record<string, any> = {};
    for (const a of attendance) {
      const uid = a.user_id;
      const name = a.users?.full_name || "—";
      if (!map[uid]) {
        map[uid] = {
          user_id: uid,
          full_name: name,
          position: a.users?.position,
          dept: a.users?.departments?.name,
          totalDays: 0,
          missedCi: 0,
          missedCo: 0,
          lateDays: 0,
          earlyDays: 0,
          totalLateMin: 0,
          totalEarlyMin: 0,
          totalPenalty: 0,
        };
      }
      map[uid].totalDays++;
      if (a.missed_checkin) map[uid].missedCi++;
      if (a.missed_checkout) map[uid].missedCo++;
      if ((a.late_minutes ?? 0) > 0) { map[uid].lateDays++; map[uid].totalLateMin += a.late_minutes; }
      if ((a.early_leave_minutes ?? 0) > 0) { map[uid].earlyDays++; map[uid].totalEarlyMin += a.early_leave_minutes; }
      map[uid].totalPenalty += a.penalty_amount || 0;
    }
    return Object.values(map).sort((a: any, b: any) =>
      (b.missedCi + b.missedCo + b.lateDays + b.earlyDays) - (a.missedCi + a.missedCo + a.lateDays + a.earlyDays)
    );
  }, [attendance]);

  let filtered = attendance;
  if (userFilter) filtered = filtered.filter((a: any) => a.user_id === userFilter);
  if (filter === "issues") {
    filtered = filtered.filter((a: any) => a.missed_checkin || a.missed_checkout || (a.late_minutes ?? 0) > 0 || (a.early_leave_minutes ?? 0) > 0);
  }

  filtered = [...filtered].sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

  const selectedUser = userSummary.find((u: any) => u.user_id === userFilter);

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="text-xs uppercase font-semibold text-gray-500 mb-2">{t("Số buổi chấm công theo NV (bấm để xem chi tiết)")}</div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setUserFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              userFilter === ""
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
            }`}>
            {t("Tất cả NV")} ({attendance.length} {t("buổi")})
          </button>
          {userSummary.map((u: any) => {
            const issues = u.missedCi + u.missedCo + u.lateDays + u.earlyDays;
            const isActive = userFilter === u.user_id;
            return (
              <button
                key={u.user_id}
                onClick={() => setUserFilter(u.user_id)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition text-left ${
                  isActive
                    ? "bg-brand-600 text-white border-brand-600"
                    : issues > 0
                    ? "bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-500"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}>
                <div className="font-semibold">{u.full_name}</div>
                <div className={`text-[10px] mt-0.5 ${isActive ? "text-white/90" : "text-gray-500"}`}>
                  {u.totalDays} {t("buổi")}
                  {issues > 0 && <> · {issues}</>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedUser && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="font-bold">{selectedUser.full_name}</div>
            <div className="text-xs text-gray-600">
              {selectedUser.position || "—"} · {selectedUser.dept || t("Chưa gán phòng")}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <Stat label={t("Đã chấm")} value={`${selectedUser.totalDays} ${t("buổi")}`} color="text-brand-700" />
            <Stat label={t("Quên CI")} value={selectedUser.missedCi} color={selectedUser.missedCi > 0 ? "text-red-600" : "text-gray-400"} />
            <Stat label={t("Quên CO")} value={selectedUser.missedCo} color={selectedUser.missedCo > 0 ? "text-red-600" : "text-gray-400"} />
            <Stat label={t("Đi muộn")} value={`${selectedUser.lateDays}d / ${selectedUser.totalLateMin}p`} color={selectedUser.lateDays > 0 ? "text-yellow-700" : "text-gray-400"} />
            <Stat label={t("Tổng phạt")} value={fmtVND(selectedUser.totalPenalty)} color={selectedUser.totalPenalty > 0 ? "text-red-600" : "text-gray-400"} />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded text-xs font-semibold ${filter === "all" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700"}`}>
          {t("Tất cả")} ({userFilter ? filtered.length : attendance.length})
        </button>
        <button onClick={() => setFilter("issues")}
          className={`px-3 py-1.5 rounded text-xs font-semibold ${filter === "issues" ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-700"}`}>
          {t("Có vấn đề")} ({(userFilter ? attendance.filter((a: any) => a.user_id === userFilter) : attendance).filter((a: any) => a.missed_checkin || a.missed_checkout || (a.late_minutes ?? 0) > 0 || (a.early_leave_minutes ?? 0) > 0).length})
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="text-left p-2">{t("Ngày")}</th>
            {!userFilter && <th className="text-left p-2">{t("NV")}</th>}
            <th className="text-left p-2">{t("Vào / Ra")}</th>
            <th className="text-left p-2">{t("Trạng thái")}</th>
            <th className="text-right p-2">{t("Phạt")}</th>
            <th className="text-right p-2 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a: any) => <EditRow key={a.id} att={a} hideUserCol={!!userFilter} />)}
          {filtered.length === 0 && (
            <tr><td colSpan={userFilter ? 5 : 6} className="p-8 text-center text-gray-400">
              {userFilter ? t("NV này chưa có bản ghi nào tháng này") : t("Không có bản ghi")}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <div className="text-center px-2 py-1 bg-white rounded">
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <div className={`font-bold ${color}`}>{value}</div>
    </div>
  );
}

function EditRow({ att, hideUserCol }: { att: any; hideUserCol?: boolean }) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    check_in: att.check_in_time ? new Date(att.check_in_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }) : "",
    check_out: att.check_out_time ? new Date(att.check_out_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }) : "",
    reason: "",
    waive: true
  });
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  const save = () => {
    if (!form.reason || form.reason.length < 5) { setMsg(t("Cần lý do ≥5 ký tự")); return; }
    startTransition(async () => {
      const res = await adminEditAttendance({
        attendance_id: att.id,
        user_id: att.user_id,
        date: att.date,
        new_check_in: form.check_in || null,
        new_check_out: form.check_out || null,
        reason: form.reason,
        waive_penalty: form.waive
      });
      if (res.success) {
        setMsg(t("Đã lưu"));
        setTimeout(() => { setEditing(false); setMsg(""); }, 1000);
      } else {
        setMsg("" + res.error);
      }
    });
  };

  if (editing) {
    return (
      <tr className="border-t border-gray-100 bg-yellow-50">
        <td colSpan={hideUserCol ? 5 : 6} className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <div>
              <label className="text-xs">{t("Vào (HH:mm)")}</label>
              <input type="time" value={form.check_in} onChange={e => setForm({...form, check_in: e.target.value})}
                className="w-full p-1.5 border border-gray-200 rounded text-sm" />
            </div>
            <div>
              <label className="text-xs">{t("Ra (HH:mm)")}</label>
              <input type="time" value={form.check_out} onChange={e => setForm({...form, check_out: e.target.value})}
                className="w-full p-1.5 border border-gray-200 rounded text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs">{t("Lý do *")}</label>
              <input value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
                placeholder={t("VD: NV quên check-out cuối ngày, đã xác nhận với QL")}
                className="w-full p-1.5 border border-gray-200 rounded text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={form.waive} onChange={e => setForm({...form, waive: e.target.checked})} />
                {t("Miễn phạt")}
              </label>
              <div className="flex gap-1">
                <button onClick={save} disabled={pending} className="px-2 py-1 bg-green-600 text-white rounded text-xs"><Save className="w-3 h-3 inline" /> {t("Lưu")}</button>
                <button onClick={() => setEditing(false)} className="px-2 py-1 bg-gray-200 rounded text-xs">{t("Huỷ")}</button>
              </div>
            </div>
          </div>
          {msg && <div className="text-xs mt-1">{msg}</div>}
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-t border-gray-100 ${(att.missed_checkin || att.missed_checkout) ? "bg-red-50/50" : ""}`}>
      <td className="p-2 text-xs">{att.date}</td>
      {!hideUserCol && (
        <td className="p-2">
          <div className="font-medium text-sm">{att.users?.full_name}</div>
          <div className="text-xs text-gray-500">{att.users?.position}</div>
        </td>
      )}
      <td className="p-2 text-xs">
        {att.check_in_time ? new Date(att.check_in_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "—"} /
        {" "}{att.check_out_time ? new Date(att.check_out_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "—"}
      </td>
      <td className="p-2 text-xs">
        {att.missed_checkin && <span className="bg-red-100 text-red-700 px-1.5 rounded">{t("Quên CI")}</span>}
        {att.missed_checkout && <span className="bg-red-100 text-red-700 px-1.5 rounded ml-1">{t("Quên CO")}</span>}
        {(att.late_minutes ?? 0) > 0 && <span className="bg-orange-100 text-orange-700 px-1.5 rounded ml-1">{t("Muộn")} {att.late_minutes}p</span>}
        {(att.early_leave_minutes ?? 0) > 0 && <span className="bg-yellow-100 text-yellow-700 px-1.5 rounded ml-1">{t("Sớm")} {att.early_leave_minutes}p</span>}
      </td>
      <td className="p-2 text-right tabular-nums text-xs text-red-600">{att.penalty_amount > 0 ? fmtVND(att.penalty_amount) : "—"}</td>
      <td className="p-2 text-right">
        <button onClick={() => setEditing(true)} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded inline-flex items-center gap-1">
          <Edit3 className="w-3 h-3" /> {t("Sửa")}
        </button>
      </td>
    </tr>
  );
}

function HistoryTab({ attendance }: any) {
  const { t } = useLang();
  return (
    <div className="p-4">
      <div className="text-sm text-gray-500 mb-3">{t("Lịch sử các bản chấm công đã được sửa")}</div>
      <div className="text-sm">{t("— Tính năng đang phát triển — sẽ hiển thị attendance_edits từ DB")}</div>
    </div>
  );
}
