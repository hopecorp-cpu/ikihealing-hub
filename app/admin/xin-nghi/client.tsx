"use client";
import { useState, useTransition } from "react";
import { approveLeave, rejectLeave } from "./actions";
import { Check, X, Clock, Calendar, Eye, AlertCircle } from "lucide-react";
import { useLang } from "@/components/lang-provider";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  phep: { label: "Nghỉ phép", color: "bg-blue-100 text-blue-700" },
  om: { label: "Nghỉ ốm", color: "bg-red-100 text-red-700" },
  khong_luong: { label: "Không lương", color: "bg-gray-100 text-gray-700" },
  ot: { label: "OT bù", color: "bg-purple-100 text-purple-700" },
  cong_tac: { label: "Công tác", color: "bg-green-100 text-green-700" },
  hieu_hi: { label: "Hiếu hỉ", color: "bg-pink-100 text-pink-700" },
  ra_ngoai: { label: "Ra ngoài", color: "bg-amber-100 text-amber-700" },
};

export function LeavesAdminClient({ pending, approved, rejected, statsByType }: any) {
  const { t } = useLang();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const list = tab === "pending" ? pending : tab === "approved" ? approved : rejected;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <div className="text-xs uppercase font-semibold text-gray-500 mb-2">{t("Đã duyệt theo loại")}</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(statsByType).map(([type, days]) => {
            const cfg = TYPE_LABELS[type] || { label: type, color: "bg-gray-100 text-gray-700" };
            return (
              <div key={type} className={`px-3 py-1.5 rounded-lg ${cfg.color} text-sm`}>
                <b>{t(cfg.label)}:</b> {(days as number).toFixed(1)} {t("ngày")}
              </div>
            );
          })}
          {Object.keys(statsByType).length === 0 && (
            <div className="text-sm text-gray-400 italic">{t("Chưa có đơn nào được duyệt năm nay")}</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="flex border-b border-gray-200">
          <TabButton active={tab === "pending"} onClick={() => setTab("pending")}
            label={t("Chờ duyệt")} count={pending.length} accent="yellow" />
          <TabButton active={tab === "approved"} onClick={() => setTab("approved")}
            label={t("Đã duyệt")} count={approved.length} accent="emerald" />
          <TabButton active={tab === "rejected"} onClick={() => setTab("rejected")}
            label={t("Từ chối")} count={rejected.length} accent="red" />
        </div>

        {list.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {tab === "pending" ? t("Không có đơn nào chờ duyệt") : `${t("Chưa có đơn")} ${tab === "approved" ? t("đã duyệt") : t("bị từ chối")}`}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((l: any) => (
              <LeaveRow key={l.id} leave={l} canDecide={tab === "pending"} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, count, accent }: any) {
  const colors: any = {
    yellow: active ? "border-yellow-500 text-yellow-700 bg-yellow-50" : "text-gray-500",
    emerald: active ? "border-emerald-500 text-emerald-700 bg-emerald-50" : "text-gray-500",
    red: active ? "border-red-500 text-red-700 bg-red-50" : "text-gray-500",
  };
  return (
    <button onClick={onClick}
      className={`flex-1 py-3 px-4 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-2 ${
        active ? colors[accent] : "border-transparent hover:bg-gray-50"
      }`}>
      {label}
      {count > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
          accent === "yellow" ? "bg-yellow-500 text-white" :
          accent === "emerald" ? "bg-emerald-500 text-white" :
          "bg-red-500 text-white"
        }`}>{count}</span>
      )}
    </button>
  );
}

function LeaveRow({ leave, canDecide }: { leave: any; canDecide: boolean }) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [msg, setMsg] = useState("");
  const [expand, setExpand] = useState(false);

  const cfg = TYPE_LABELS[leave.type] || { label: leave.type, color: "bg-gray-100 text-gray-700" };

  const onApprove = () => {
    startTransition(async () => {
      const res = await approveLeave(leave.id, approveNote);
      if (res.success) { setMsg(t("Đã duyệt")); setTimeout(() => location.reload(), 600); }
      else setMsg("" + (res as any).error);
    });
  };

  const onReject = () => {
    if (rejectNote.length < 3) { setMsg(t("Cần ghi lý do ≥3 ký tự")); return; }
    startTransition(async () => {
      const res = await rejectLeave(leave.id, rejectNote);
      if (res.success) { setMsg(t("Đã từ chối")); setTimeout(() => location.reload(), 600); }
      else setMsg("" + (res as any).error);
    });
  };

  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold">{leave.user?.full_name || "—"}</span>
            <span className="text-xs text-gray-500">
              {leave.user?.position} {leave.user?.departments?.name && `· ${leave.user.departments.name}`}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${cfg.color}`}>{t(cfg.label)}</span>
          </div>
          <div className="text-sm text-gray-700">
            <Calendar className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
            {leave.type === "ra_ngoai" ? (
              <>{leave.from_date} · <b>{leave.from_time} → {leave.to_time}</b></>
            ) : (
              <>{leave.from_date} → {leave.to_date} · <b>{leave.days} {t("ngày")}</b></>
            )}
          </div>
          {leave.reason && (
            <div className="text-xs text-gray-600 mt-1 italic">
              {expand || leave.reason.length < 100 ? leave.reason : leave.reason.slice(0, 100) + "..."}
              {leave.reason.length >= 100 && (
                <button onClick={() => setExpand(!expand)} className="ml-1 text-blue-600 hover:underline">
                  {expand ? t("thu gọn") : t("xem thêm")}
                </button>
              )}
            </div>
          )}
          {leave.approver?.full_name && (
            <div className="text-xs text-gray-500 mt-1">
              {leave.status === "approved" ? t("✓ Duyệt bởi") : t("✗ Từ chối bởi")}: <b>{leave.approver.full_name}</b>
              {leave.decided_at && ` · ${new Date(leave.decided_at).toLocaleString("vi-VN")}`}
              {leave.approver_note && <div className="italic text-gray-600 mt-0.5">"{leave.approver_note}"</div>}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-400 text-right shrink-0">
          <Clock className="w-3 h-3 inline mr-1" />
          {new Date(leave.created_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {canDecide && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {!showReject ? (
            <div className="flex gap-2 items-center flex-wrap">
              <input
                value={approveNote}
                onChange={e => setApproveNote(e.target.value)}
                placeholder={t("Ghi chú khi duyệt (tuỳ chọn)")}
                className="flex-1 min-w-[200px] p-2 border border-gray-200 rounded text-sm"
              />
              <button onClick={onApprove} disabled={pending}
                className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-50">
                <Check className="w-4 h-4" /> {t("Duyệt")}
              </button>
              <button onClick={() => setShowReject(true)} disabled={pending}
                className="px-4 py-2 bg-red-100 text-red-700 border border-red-200 rounded text-sm font-semibold inline-flex items-center gap-1">
                <X className="w-4 h-4" /> {t("Từ chối")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-center flex-wrap bg-red-50 p-2 rounded">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <input
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder={t("Lý do từ chối (BẮT BUỘC)")}
                autoFocus
                className="flex-1 min-w-[200px] p-2 border border-red-300 rounded text-sm"
              />
              <button onClick={onReject} disabled={pending}
                className="px-3 py-2 bg-red-600 text-white rounded text-sm font-semibold">{t("Xác nhận từ chối")}</button>
              <button onClick={() => { setShowReject(false); setRejectNote(""); }}
                className="px-3 py-2 border rounded text-sm">{t("Huỷ")}</button>
            </div>
          )}
          {msg && <div className="mt-2 text-sm">{msg}</div>}
        </div>
      )}
    </div>
  );
}
