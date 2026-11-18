"use client";
import { useState, useTransition } from "react";
import { terminateEmployee, reactivateEmployee } from "./actions";
import { UserMinus, RotateCcw, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";

export function TerminateButton({ userId, userName, isActive, currentTerminatedAt }: {
  userId: string;
  userName: string;
  isActive: boolean;
  currentTerminatedAt?: string | null;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [terminatedAt, setTerminatedAt] = useState(currentTerminatedAt ?? new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("Lý do cá nhân");
  const [msg, setMsg] = useState("");

  const onTerminate = () => {
    setMsg("");
    startTransition(async () => {
      const res = await terminateEmployee({ userId, terminatedAt, reason });
      if (res.success) {
        setMsg("✓ " + t("Đã ghi nhận thôi việc"));
        setTimeout(() => { setOpen(false); setMsg(""); }, 1200);
      } else {
        setMsg("✕ " + res.error);
      }
    });
  };

  const onReactivate = () => {
    if (!confirm(t("Khôi phục về trạng thái đang làm?"))) return;
    startTransition(async () => {
      const res = await reactivateEmployee(userId);
      if (!res.success) alert(res.error);
    });
  };

  if (!isActive) {
    return (
      <button onClick={onReactivate} disabled={pending}
        className="px-2 py-1 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50">
        <RotateCcw className="w-3 h-3" /> {t("Khôi phục")}
      </button>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 inline-flex items-center gap-1">
        <UserMinus className="w-3 h-3" /> {t("Cho nghỉ")}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !pending && setOpen(false)}>
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl text-left" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <UserMinus className="w-5 h-5 text-red-600" />
                {t("Cho thôi việc")}
              </h2>
              <button onClick={() => !pending && setOpen(false)} className="p-1.5 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                {t("Nhân viên")}: <b>{userName}</b>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">{t("Ngày thôi việc")}</label>
                <input type="date" value={terminatedAt} onChange={e => setTerminatedAt(e.target.value)}
                  className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">{t("Lý do")}</label>
                <select value={reason} onChange={e => setReason(e.target.value)}
                  className="mt-1 w-full p-2.5 border border-gray-200 rounded-lg text-sm">
                  <option>{t("Lý do cá nhân")}</option>
                  <option>{t("Kết thúc thử việc")}</option>
                  <option>{t("Không phù hợp")}</option>
                  <option>{t("Hết hợp đồng")}</option>
                  <option>{t("Vi phạm kỷ luật")}</option>
                  <option>{t("Sa thải")}</option>
                  <option>{t("Tự nguyện")}</option>
                  <option>{t("Khác")}</option>
                </select>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                {t("Sau khi xác nhận:")}<br/>
                {t("• NV chuyển sang trạng thái \"Đã nghỉ\"")}<br/>
                {t("• Vẫn được tính lương cho NC đã làm trong tháng nghỉ")}<br/>
                {t("• Tháng sau không có trong bảng lương")}<br/>
                {t("• Có thể \"Khôi phục\" nếu nhập nhầm")}
              </div>

              {msg && <div className={`p-2 rounded text-sm ${msg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg}</div>}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-100">
              <button onClick={() => !pending && setOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                {t("Huỷ")}
              </button>
              <button onClick={onTerminate} disabled={pending}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
                {pending ? t("Đang xử lý...") : t("Xác nhận thôi việc")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
