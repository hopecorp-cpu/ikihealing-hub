"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveGpsAttendance, rejectGpsAttendance, approveAllGpsAttendance } from "./actions";
import { MapPinOff, Check, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";

function fmt(t: string | null) {
  if (!t) return "—";
  return new Date(t).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

export function GpsReviewSection({ rows, month }: { rows: any[]; month: string }) {
  const { t } = useLang();
  const [pending, start] = useTransition();
  const [photo, setPhoto] = useState<string | null>(null);
  const router = useRouter();

  if (!rows || rows.length === 0) return null;

  const run = (fn: () => Promise<any>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="bg-white border border-amber-300 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-amber-100 flex items-center gap-2 bg-amber-50">
        <MapPinOff className="w-5 h-5 text-amber-600" />
        <h2 className="font-semibold text-amber-900">{t("Check-in chờ duyệt GPS —")} {rows.length} {t("bản ghi")}</h2>
        <button
          onClick={() => { if (confirm(`${t("Duyệt TẤT CẢ")} ${rows.length} ${t("check-in không GPS tháng")} ${month}?`)) run(() => approveAllGpsAttendance(month)); }}
          disabled={pending}
          className="ml-auto px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {t("✓ Duyệt tất cả")} ({rows.length})
        </button>
      </div>
      <p className="px-4 py-2 text-xs text-gray-500">
        {t("NV không lấy được GPS lúc check-in → cần admin xác minh.")} <b>{t("Duyệt")}</b> {t("= tính công hợp lệ ·")} <b>{t("Từ chối")}</b> {t("= xoá bản ghi (coi như chưa chấm).")}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-3">{t("Nhân viên")}</th>
              <th className="text-left p-3">{t("Ngày · Giờ vào")}</th>
              <th className="text-center p-3">{t("Ảnh")}</th>
              <th className="text-center p-3">{t("Hành động")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-amber-50/40">
                <td className="p-3">
                  <div className="font-medium whitespace-nowrap">{r.users?.full_name ?? r.user_id}</div>
                  <div className="text-[11px] text-gray-500 whitespace-nowrap">{r.users?.position ?? ""}</div>
                </td>
                <td className="p-3 whitespace-nowrap">
                  <div>{r.date}</div>
                  <div className="text-[11px] text-gray-500">{t("Vào:")} {fmt(r.check_in_time)}</div>
                </td>
                <td className="p-3 text-center">
                  {r.check_in_photo_url
                    ? <img src={r.check_in_photo_url} onClick={() => setPhoto(r.check_in_photo_url)} className="w-10 h-10 rounded-full object-cover mx-auto cursor-pointer border border-gray-200" alt="in" />
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="p-3">
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => run(() => approveGpsAttendance(r.id))} disabled={pending}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-medium disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" /> {t("Duyệt")}
                    </button>
                    <button onClick={() => { if (confirm(`${t("Từ chối & XOÁ check-in của")} ${r.users?.full_name} ${t("ngày")} ${r.date}?`)) run(() => rejectGpsAttendance(r.id)); }} disabled={pending}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-medium disabled:opacity-50">
                      <X className="w-3.5 h-3.5" /> {t("Từ chối")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {photo && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPhoto(null)}>
          <img src={photo} alt="zoom" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}
