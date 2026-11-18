"use client";
import { useEffect, useState, useTransition } from "react";
import { getTodayAttendance } from "../actions";
import { CheckCircle2, Clock, AlertTriangle, MapPin, Home, RefreshCw, XCircle, Users } from "lucide-react";
import { useLang } from "@/components/lang-provider";

type Row = Awaited<ReturnType<typeof getTodayAttendance>>["rows"][number];
type Summary = Awaited<ReturnType<typeof getTodayAttendance>>["summary"];

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "—";

const statusBadge = (s: Row["status"]) => {
  switch (s) {
    case "ok": return { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "✓ Đúng giờ", icon: CheckCircle2 };
    case "late": return { color: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "⏰ Đi muộn", icon: Clock };
    case "early": return { color: "bg-orange-100 text-orange-700 border-orange-200", label: "Về sớm", icon: Clock };
    case "no_checkout": return { color: "bg-red-100 text-red-700 border-red-200", label: "Quên check-out", icon: AlertTriangle };
    case "no_checkin": return { color: "bg-red-100 text-red-700 border-red-200", label: "Quên check-in", icon: AlertTriangle };
    case "absent": return { color: "bg-gray-100 text-gray-600 border-gray-200", label: "○ Chưa chấm", icon: XCircle };
  }
};

export function TodayClient({ initial }: { initial: { rows: Row[]; summary: Summary; date: string } }) {
  const { t } = useLang();
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<"all" | "absent" | "late" | "no_checkout" | "remote">("all");

  const refresh = () => {
    startTransition(async () => {
      const fresh = await getTodayAttendance(data.date);
      setData(fresh);
    });
  };

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, data.date]);

  const rows = data.rows.filter(r => {
    if (filter === "all") return true;
    if (filter === "absent") return r.status === "absent";
    if (filter === "late") return r.late_minutes > 0;
    if (filter === "no_checkout") return r.status === "no_checkout";
    if (filter === "remote") return r.work_location === "remote";
    return true;
  });

  const s = data.summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label={t("TỔNG NV")} value={s.total} color="#6B7280" icon={Users} onClick={() => setFilter("all")} active={filter === "all"} />
        <KpiCard label={t("ĐÃ VÀO")} value={s.checkedIn} color="#10B981" icon={CheckCircle2} sub={`${s.total - s.checkedIn} ${t("chưa")}`} />
        <KpiCard label={t("ĐÃ RA")} value={s.checkedOut} color="#3B82F6" icon={CheckCircle2} sub={`${s.checkedIn - s.checkedOut} ${t("chưa")}`} />
        <KpiCard label={t("ĐI MUỘN")} value={s.late} color="#F59E0B" icon={Clock} onClick={() => setFilter("late")} active={filter === "late"} />
        <KpiCard label={t("QUÊN OUT")} value={s.no_checkout} color="#EF4444" icon={AlertTriangle} onClick={() => setFilter("no_checkout")} active={filter === "no_checkout"} />
        <KpiCard label={t("REMOTE")} value={s.remote} color="#8B5CF6" icon={Home} onClick={() => setFilter("remote")} active={filter === "remote"} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 text-xs">
          <FilterChip current={filter} value="all" label={t("Tất cả")} onClick={setFilter} />
          <FilterChip current={filter} value="absent" label={`${t("Chưa chấm")} (${s.absent})`} onClick={setFilter} />
          <FilterChip current={filter} value="late" label={`${t("Đi muộn")} (${s.late})`} onClick={setFilter} />
          <FilterChip current={filter} value="no_checkout" label={`${t("Quên out")} (${s.no_checkout})`} onClick={setFilter} />
          <FilterChip current={filter} value="remote" label={`Remote (${s.remote})`} onClick={setFilter} />
        </div>
        <div className="flex gap-2 items-center text-xs">
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            <span>{t("Auto-refresh 30s")}</span>
          </label>
          <button onClick={refresh} disabled={pending}
            className="px-3 py-1 bg-gray-900 text-white rounded inline-flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${pending ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-3">{t("Nhân viên")}</th>
              <th className="text-left p-3">{t("Phòng / Mode")}</th>
              <th className="text-left p-3">{t("Ảnh")}</th>
              <th className="text-left p-3">{t("Vào")}</th>
              <th className="text-left p-3">{t("Ra")}</th>
              <th className="text-left p-3">{t("Trạng thái")}</th>
              <th className="text-left p-3">{t("Nơi")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const badge = statusBadge(r.status);
              return (
                <tr key={r.user_id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-gray-500">{r.position || "—"}</div>
                  </td>
                  <td className="p-3 text-xs">
                    <div>{r.department || "—"}</div>
                    <span className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                      r.work_mode === "remote" ? "bg-emerald-50 text-emerald-700" :
                      r.work_mode === "hybrid" ? "bg-blue-50 text-blue-700" :
                      "bg-amber-50 text-amber-700"
                    }`}>{r.work_mode || "office"}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {r.check_in_photo_url && (
                        <img src={r.check_in_photo_url} alt="In"
                          className="w-8 h-8 rounded-full border border-brand-200 object-cover" />
                      )}
                      {r.check_out_photo_url && (
                        <img src={r.check_out_photo_url} alt="Out"
                          className="w-8 h-8 rounded-full border border-orange-200 object-cover" />
                      )}
                      {!r.check_in_photo_url && !r.check_out_photo_url && <span className="text-xs text-gray-300">—</span>}
                    </div>
                  </td>
                  <td className="p-3 tabular-nums">
                    {fmtTime(r.check_in_time)}
                    {r.late_minutes > 0 && <span className="ml-1 text-xs text-yellow-600">+{r.late_minutes}p</span>}
                  </td>
                  <td className="p-3 tabular-nums">
                    {fmtTime(r.check_out_time)}
                    {r.early_leave_minutes > 0 && <span className="ml-1 text-xs text-orange-600">-{r.early_leave_minutes}p</span>}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${badge.color}`}>{t(badge.label)}</span>
                  </td>
                  <td className="p-3 text-xs">
                    {r.work_location === "remote" ? (
                      <span className="text-emerald-700 inline-flex items-center gap-1"><Home className="w-3 h-3" /> Remote</span>
                    ) : r.work_location === "office" ? (
                      <span className="text-blue-700 inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {t("Văn phòng")}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center text-gray-400">{t("Không có NV nào khớp bộ lọc")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 text-center">
        {t("Cập nhật lần cuối:")} {new Date().toLocaleTimeString("vi-VN")}
        {autoRefresh && <span> · auto-refresh sau 30s</span>}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, icon: Icon, sub, onClick, active }: any) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white border rounded-xl p-3 transition ${
        active ? "border-gray-900 ring-2 ring-gray-300" : "border-gray-200 hover:border-gray-300"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex justify-between items-center mb-1">
        <div className="text-[10px] uppercase font-semibold text-gray-500">{label}</div>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </button>
  );
}

function FilterChip({ current, value, label, onClick }: { current: string; value: any; label: string; onClick: (v: any) => void }) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`px-3 py-1 rounded-md border ${
        active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
      }`}
    >
      {label}
    </button>
  );
}
