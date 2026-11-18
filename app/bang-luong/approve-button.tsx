"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LockOpen, Eye, EyeOff, Wallet } from "lucide-react";
import { approveMonthlyPayroll, unapproveMonthlyPayroll, approveOnePayroll, unapproveOnePayroll, markPaidPayroll, unmarkPaidPayroll } from "./run/actions";
import { useLang } from "@/components/lang-provider";

export function PaidToggle({ payrollId, status }: { payrollId: string; status: string }) {
  const { t } = useLang();
  const [busy, start] = useTransition();
  const router = useRouter();
  const paid = status === "paid";
  const canPay = status === "approved" || status === "paid";
  const toggle = () => start(async () => {
    const res = paid ? await unmarkPaidPayroll(payrollId) : await markPaidPayroll(payrollId);
    if ((res as any).success) router.refresh();
  });
  if (!canPay) return <span className="text-[11px] text-gray-300" title={t("Phải duyệt trước")}>—</span>;
  return (
    <button onClick={toggle} disabled={busy}
      className={`text-[11px] px-2 py-1 rounded font-medium disabled:opacity-50 inline-flex items-center gap-1 ${paid ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"}`}
      title={paid ? t("Đã thanh toán — bấm để bỏ đánh dấu") : t("Bấm để đánh dấu ĐÃ chuyển lương cho NV")}>
      <Wallet className="w-3 h-3" /> {paid ? t("Đã trả ✓") : t("Chưa trả")}
    </button>
  );
}

export function RowApprove({ payrollId, status }: { payrollId: string; status: string }) {
  const { t } = useLang();
  const [busy, start] = useTransition();
  const router = useRouter();
  const approved = status === "approved" || status === "paid";
  const toggle = () => start(async () => {
    const res = approved ? await unapproveOnePayroll(payrollId) : await approveOnePayroll(payrollId);
    if ((res as any).success) router.refresh();
  });
  if (status === "paid") return <span className="text-[11px] text-gray-500">{t("Đã trả")}</span>;
  return (
    <button onClick={toggle} disabled={busy}
      className={`text-[11px] px-2 py-1 rounded font-medium disabled:opacity-50 ${approved ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-500 text-white"}`}
      title={approved ? t("Đang cho NV xem — bấm để ẩn lại (mở sửa)") : t("Bấm để duyệt — cho NV này xem phiếu lương")}>
      {approved ? t("✓ Đã duyệt") : t("Duyệt")}
    </button>
  );
}

export function ApproveButton({ month, pendingCount, approvedCount }: { month: string; pendingCount: number; approvedCount: number }) {
  const { t } = useLang();
  const [busy, start] = useTransition();
  const router = useRouter();
  const [msg, setMsg] = useState("");

  const approve = () => {
    if (!confirm(`${t("Duyệt bảng lương tháng")} ${month}?\n\n${pendingCount} ${t("dòng sẽ chuyển \"Đã duyệt\" → NHÂN VIÊN xem được phiếu lương.")}\n${t("Kiểm tra kỹ trước khi duyệt.")}`)) return;
    start(async () => {
      const res = await approveMonthlyPayroll(month);
      if (res.success) { setMsg(`${t("Đã duyệt")} ${res.approved} ${t("dòng — NV xem được")}`); router.refresh(); }
      else setMsg("" + res.error);
      setTimeout(() => setMsg(""), 4000);
    });
  };
  const reopen = () => {
    if (!confirm(`${t("Mở lại bảng lương tháng")} ${month} ${t("để sửa?")}\n\n${t("NV sẽ TẠM THỜI KHÔNG xem được phiếu lương cho tới khi duyệt lại.")}`)) return;
    start(async () => {
      const res = await unapproveMonthlyPayroll(month);
      if (res.success) { setMsg(`${t("Đã mở lại")} ${res.reopened} ${t("dòng — NV không xem được nữa")}`); router.refresh(); }
      else setMsg("" + res.error);
      setTimeout(() => setMsg(""), 4000);
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {msg && <span className="text-xs text-gray-600">{msg}</span>}
      {pendingCount > 0 && (
        <button onClick={approve} disabled={busy}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
          <CheckCircle2 className="w-4 h-4" /> {t("Duyệt — cho NV xem")} ({pendingCount})
        </button>
      )}
      {pendingCount === 0 && approvedCount > 0 && (
        <>
          <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {t("NV đang xem được")}</span>
          <button onClick={reopen} disabled={busy}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 inline-flex items-center gap-1.5 disabled:opacity-50">
            <LockOpen className="w-4 h-4" /> {t("Mở lại để sửa")}
          </button>
        </>
      )}
      {pendingCount > 0 && (
        <span className="text-xs text-amber-600 inline-flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" /> {t("NV CHƯA xem được (chờ duyệt)")}</span>
      )}
    </div>
  );
}
