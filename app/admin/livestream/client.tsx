"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addLivestreamSession, deleteLivestreamSession } from "./actions";
import { fmtVND } from "@/lib/payroll";
import { Video, Trash2 } from "lucide-react";
import { useLang } from "@/components/lang-provider";

export function LivestreamClient({ month, users, rows, ready }: { month: string; users: any[]; rows: any[]; ready: boolean }) {
  const { t } = useLang();
  const [pending, start] = useTransition();
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(`${month}-01`);
  const [headcount, setHeadcount] = useState("1");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const amount = Number(headcount) >= 2 ? 200000 : 300000;
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);

  const add = () => {
    if (!userId) { setMsg(t("Chọn nhân viên")); return; }
    start(async () => {
      const res = await addLivestreamSession({ user_id: userId, session_date: date, headcount: Number(headcount), note });
      setMsg(res.success ? `${t("Đã thêm buổi live")} +${fmtVND((res as any).amount)}` : "" + res.error);
      if (res.success) { setNote(""); router.refresh(); }
      setTimeout(() => setMsg(""), 4000);
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Video className="w-6 h-6 text-pink-600" /> {t("Thưởng Livestream")}</h1>
        <form className="flex gap-2 items-center">
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 text-sm text-pink-900">
        {t("Chế độ: Sale/MKT lên live")} <b>{t("1 buổi")}</b> {t("— nói")} <b>{t("1 mình = 300.000đ")}</b> · <b>{t("từ 2 người = 200.000đ/người")}</b>. {t("Tự cộng vào lương tháng.")}
      </div>

      {!ready && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          {t("Chưa chạy migration 023 (bảng livestream_sessions). Chạy SQL rồi mới thêm/lưu được.")}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
        <label className="sm:col-span-2">
          <span className="text-xs text-gray-500 block mb-1">{t("Nhân viên")}</span>
          <select value={userId} onChange={e => setUserId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm">
            <option value="">{t("— Chọn —")}</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name} · {u.position}</option>)}
          </select>
        </label>
        <label>
          <span className="text-xs text-gray-500 block mb-1">{t("Ngày live")}</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label>
          <span className="text-xs text-gray-500 block mb-1">{t("Số người lên live")}</span>
          <select value={headcount} onChange={e => setHeadcount(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm">
            <option value="1">{t("1 (nói 1 mình) → 300k")}</option>
            <option value="2">{t("≥2 người → 200k")}</option>
          </select>
        </label>
        <button onClick={add} disabled={pending || !ready}
          className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {t("+ Thêm")} ({fmtVND(amount)})
        </button>
      </div>
      <label className="block -mt-3">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder={t("Ghi chú (tuỳ chọn): chủ đề buổi live…")}
          className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
      </label>
      {msg && <p className="text-sm font-medium">{msg}</p>}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">{t("Buổi live tháng")} {month}</h2>
          <span className="text-sm text-gray-600">{t("Tổng:")} <b className="text-pink-700">{fmtVND(total)}</b> · {rows.length} {t("buổi")}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr><th className="text-left p-3">{t("Nhân viên")}</th><th className="text-left p-3">{t("Ngày")}</th><th className="text-center p-3">{t("Số người")}</th><th className="text-right p-3">{t("Thưởng")}</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="p-3"><div className="font-medium">{r.users?.full_name}</div><div className="text-[11px] text-gray-500">{t(r.note)}</div></td>
                <td className="p-3">{r.session_date}</td>
                <td className="p-3 text-center">{r.headcount === 1 ? t("1 (một mình)") : `${r.headcount} ${t("người")}`}</td>
                <td className="p-3 text-right font-semibold text-pink-700">{fmtVND(r.amount)}</td>
                <td className="p-3 text-right">
                  <button onClick={() => { if (confirm(t("Xoá buổi live này?"))) start(async () => { await deleteLivestreamSession(r.id); router.refresh(); }); }}
                    disabled={pending} className="text-red-500 hover:text-red-700 disabled:opacity-40"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">{t("Chưa có buổi live nào tháng này")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
