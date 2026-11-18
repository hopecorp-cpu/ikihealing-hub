"use client";
import { useEffect, useState, useTransition } from "react";
import { submitLeave, getMyLeaves, type LeaveType } from "./actions";
import { Clock } from "lucide-react";
import { useLang } from "@/components/lang-provider";

const TYPES: { v: LeaveType; l: string; icon?: string }[] = [
  { v: "phep", l: "Phép năm", icon: "" },
  { v: "om", l: "Ốm", icon: "" },
  { v: "khong_luong", l: "Không lương", icon: "" },
  { v: "ot", l: "OT (làm ngoài giờ)", icon: "⏰" },
  { v: "cong_tac", l: "Công tác", icon: "" },
  { v: "hieu_hi", l: "Hiếu hỉ", icon: "" },
  { v: "ra_ngoai", l: "Xin ra ngoài (giữa giờ)", icon: "" },
];

export default function XinNghiPage() {
  const { t } = useLang();
  const [list, setList] = useState<any[]>([]);
  const [type, setType] = useState<LeaveType>("phep");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [fromTime, setFromTime] = useState("14:00");
  const [toTime, setToTime] = useState("16:00");
  const [days, setDays] = useState(1); const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [pending, startTransition] = useTransition();

  const isOutDuringWork = type === "ra_ngoai";

  const load = () => {
    startTransition(async () => {
      const data = await getMyLeaves();
      setList(data);
    });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (isOutDuringWork && !from) {
      setFrom(new Date().toISOString().slice(0, 10));
    }
  }, [isOutDuringWork, from]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await submitLeave({
        type, from_date: from, to_date: to,
        from_time: isOutDuringWork ? fromTime : undefined,
        to_time: isOutDuringWork ? toTime : undefined,
        days: isOutDuringWork ? 0 : days,
        reason
      });
      if (res.success) {
        setMsg({
          text: isOutDuringWork
            ? `${t("Đã gửi đơn — tương đương")} ${(res as any).daysCalculated} ${t("ngày NC")}`
            : t("Đã gửi đơn"),
          type: "ok"
        });
        setFrom(""); setTo(""); setReason(""); setDays(1);
        setFromTime("14:00"); setToTime("16:00");
        load();
      } else {
        setMsg({ text: "" + res.error, type: "err" });
      }
      setTimeout(() => setMsg(null), 3500);
    });
  };

  const badge = (s: string) => {
    const map: any = { pending: "bg-yellow-100 text-yellow-700", approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700" };
    const lbl: any = { pending: t("Chờ duyệt"), approved: t("Đã duyệt"), rejected: t("Từ chối") };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s] || "bg-gray-100"}`}>{lbl[s] || s}</span>;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("Xin nghỉ")}</h1>

      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold mb-4">{t("Tạo đơn mới")}</h2>

        <label className="text-sm text-gray-700">{t("Loại")}</label>
        <select value={type} onChange={e => setType(e.target.value as LeaveType)} className="mt-1 mb-4 w-full p-2.5 border border-gray-200 rounded-lg text-sm">
          {TYPES.map(x => <option key={x.v} value={x.v}>{x.icon} {t(x.l)}</option>)}
        </select>

        {isOutDuringWork ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-blue-700 mb-2">
              <Clock className="w-4 h-4" />
              <span>{t("Xin ra ngoài trong giờ làm — chọn ngày + giờ ra + giờ về")}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-gray-700">{t("Ngày")}</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} required className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-700">{t("Giờ ra")}</label>
                <input type="time" value={fromTime} onChange={e => setFromTime(e.target.value)} required className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-700">{t("Giờ về")}</label>
                <input type="time" value={toTime} onChange={e => setToTime(e.target.value)} required className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              {t("Hệ thống tự trừ phần nghỉ trưa nếu vắt qua 12:00–13:30. 1 ngày NC = 8h làm việc.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-700">{t("Số ngày")}</label>
              <input type="number" step="0.5" min="0.5" value={days} onChange={e => setDays(+e.target.value)}
                className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div></div>
            <div>
              <label className="text-sm text-gray-700">{t("Từ ngày")}</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} required className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-700">{t("Đến ngày")}</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} required className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
        )}

        <label className="text-sm text-gray-700 mt-4 block">{t("Lý do")}</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} required
          className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm"
          placeholder={isOutDuringWork ? t("VD: Đi gặp khách hàng, đi khám bệnh...") : t("Nêu rõ lý do...")} />

        <div className="mt-4 flex justify-end items-center gap-3">
          {msg && <span className={`text-sm ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
          <button type="submit" disabled={pending} className="px-5 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50">
            {pending ? t("Đang gửi...") : t("Gửi đơn")}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100"><h2 className="font-semibold">{t("Đơn của tôi")}</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-3">{t("Loại")}</th>
              <th className="text-left p-3">{t("Ngày")}</th>
              <th className="text-left p-3">{t("Giờ / Số ngày")}</th>
              <th className="text-left p-3">{t("Lý do")}</th>
              <th className="text-left p-3">{t("Trạng thái")}</th>
            </tr>
          </thead>
          <tbody>
            {list.map(l => {
              const ty = TYPES.find(x => x.v === l.type);
              return (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="p-3">{ty?.icon} {ty ? t(ty.l) : ""}</td>
                  <td className="p-3 text-xs">
                    {l.type === "ra_ngoai" ? l.from_date : `${l.from_date} → ${l.to_date}`}
                  </td>
                  <td className="p-3 text-xs">
                    {l.type === "ra_ngoai" && l.from_time ? (
                      <span className="tabular-nums">{l.from_time?.slice(0,5)} - {l.to_time?.slice(0,5)} <span className="text-gray-400">({l.days} {t("ngày")})</span></span>
                    ) : (
                      `${l.days} ${t("ngày")}`
                    )}
                  </td>
                  <td className="p-3 max-w-xs truncate">{l.reason}</td>
                  <td className="p-3">{badge(l.status)}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">{t("Chưa có đơn nghỉ nào")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
