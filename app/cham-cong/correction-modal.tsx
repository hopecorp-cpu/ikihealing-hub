"use client";
import { useState, useTransition } from "react";
import { X, AlertCircle, Send } from "lucide-react";
import { submitCorrectionRequest } from "./actions";
import { vnDateStr } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

export function CorrectionRequestButton({ defaultDate }: { defaultDate?: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full sm:w-auto text-sm px-4 py-2.5 sm:py-1.5 border border-orange-300 text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 font-semibold inline-flex items-center justify-center gap-1.5">
        <AlertCircle className="w-4 h-4" /> {t("Xin sửa / bổ sung chấm công")}
      </button>
      {open && <Modal defaultDate={defaultDate} onClose={() => setOpen(false)} />}
    </>
  );
}

function Modal({ defaultDate, onClose }: { defaultDate?: string; onClose: () => void }) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [form, setForm] = useState({
    attendance_date: defaultDate || vnDateStr(),
    request_type: "missed_checkout",
    requested_check_in: "",
    requested_check_out: "",
    reason: ""
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason.trim()) { setMsg({ text: t("Phải nhập lý do"), type: "err" }); return; }
    startTransition(async () => {
      const res = await submitCorrectionRequest({
        attendance_date: form.attendance_date,
        request_type: form.request_type as any,
        requested_check_in: form.requested_check_in || undefined,
        requested_check_out: form.requested_check_out || undefined,
        reason: form.reason
      });
      if (res.success) {
        setMsg({ text: t("Đã gửi đơn — admin sẽ duyệt"), type: "ok" });
        setTimeout(onClose, 1500);
      } else {
        setMsg({ text: "" + res.error, type: "err" });
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !pending && onClose()}>
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-500" /> {t("Xin sửa chấm công")}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-sm font-medium">{t("Ngày cần sửa")}</label>
            <input type="date" required value={form.attendance_date}
              onChange={e => setForm({...form, attendance_date: e.target.value})}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>

          <div>
            <label className="text-sm font-medium">{t("Lý do")}</label>
            <select value={form.request_type}
              onChange={e => setForm({...form, request_type: e.target.value})}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
              <option value="missed_checkin">{t("Quên check-in (đến VP nhưng quên Face ID)")}</option>
              <option value="missed_checkout">{t("Quên check-out (cuối ngày quên Face ID)")}</option>
              <option value="wrong_time">{t("⏰ Thao tác sai giờ")}</option>
              <option value="other">{t("Khác")}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">{t("Giờ vào đúng (nếu có)")}</label>
              <input type="time" value={form.requested_check_in}
                onChange={e => setForm({...form, requested_check_in: e.target.value})}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600">{t("Giờ ra đúng (nếu có)")}</label>
              <input type="time" value={form.requested_check_out}
                onChange={e => setForm({...form, requested_check_out: e.target.value})}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">{t("Mô tả chi tiết *")}</label>
            <textarea required value={form.reason}
              onChange={e => setForm({...form, reason: e.target.value})}
              placeholder={t("VD: Cuối ngày em họp với khách rồi đi luôn, quên ra văn phòng quẹt Face. Mong anh duyệt cho em giờ ra 17:30.")}
              rows={4}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
            <b>{t("Lưu ý:")}</b> {t("Mỗi lần quên check-in/out sẽ bị phạt")} <b>{t("50.000đ")}</b> {t("theo quy định. Nếu được admin duyệt đơn này, mức phạt sẽ được miễn hoặc giảm.")}
          </div>

          {msg && (
            <div className={`p-2 rounded-lg text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {msg.text}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">{t("Huỷ")}</button>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-50">
              <Send className="w-3 h-3" /> {pending ? t("Đang gửi...") : t("Gửi đơn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
