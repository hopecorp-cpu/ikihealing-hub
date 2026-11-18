"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { signContractByEmployer, signContractByEmployee, terminateContract } from "../actions";
import { fmtVND } from "@/lib/payroll";
import { Printer, FileSignature, CheckCircle2, XCircle, Clock, Trash2, ArrowLeft, Edit2 } from "lucide-react";
import Link from "next/link";
import { truSoTheoNgay } from "@/lib/tru-so";

const TYPE_LABEL: Record<string, string> = {
  thu_viec: "HĐ thử việc",
  xac_dinh_1_nam: "HĐ xác định 1 năm",
  xac_dinh_2_nam: "HĐ xác định 2 năm",
  khong_xac_dinh: "HĐ không xác định thời hạn",
  ctv: "HĐ cộng tác viên",
  khoan_viec: "HĐ khoán việc",
};

export function ContractDetailClient({ contract }: { contract: any }) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [showTerminate, setShowTerminate] = useState(false);
  const [termReason, setTermReason] = useState("");

  const signEmployer = () => {
    if (!confirm(t("Đại diện công ty (CEO) ký xác nhận hợp đồng này?"))) return;
    startTransition(async () => {
      const res = await signContractByEmployer(contract.id);
      if (res.success) { setMsg({ text: t("Đã ký"), type: "ok" }); setTimeout(() => location.reload(), 600); }
      else setMsg({ text: "" + (res as any).error, type: "err" });
    });
  };

  const signEmployee = () => {
    if (!confirm(`${t("NV")} ${contract.user.full_name} ${t("đã ký xác nhận?")}`)) return;
    startTransition(async () => {
      const res = await signContractByEmployee(contract.id);
      if (res.success) { setMsg({ text: t("NV đã ký"), type: "ok" }); setTimeout(() => location.reload(), 600); }
      else setMsg({ text: "" + (res as any).error, type: "err" });
    });
  };

  const onTerminate = () => {
    if (termReason.length < 5) { setMsg({ text: t("Cần lý do ≥5 ký tự"), type: "err" }); return; }
    startTransition(async () => {
      const res = await terminateContract(contract.id, termReason);
      if (res.success) { setMsg({ text: t("Đã chấm dứt"), type: "ok" }); setTimeout(() => location.reload(), 600); }
      else setMsg({ text: "" + (res as any).error, type: "err" });
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <Link href="/admin/contracts" className="text-sm text-gray-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {t("Danh sách HĐ")}
        </Link>
        <div className="flex gap-2 flex-wrap">
          <a href={`/admin/contracts/${contract.id}/print`} target="_blank"
            className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-semibold inline-flex items-center gap-1">
            <Printer className="w-4 h-4" /> {t("Xem / In HĐ")}
          </a>
          {contract.status !== "terminated" && (
            <a href={`/admin/contracts/${contract.id}/edit`}
              className="px-4 py-2 bg-amber-100 text-amber-800 border border-amber-200 rounded text-sm font-semibold inline-flex items-center gap-1 hover:bg-amber-200">
              <Edit2 className="w-4 h-4" /> {t("Sửa HĐ")}
            </a>
          )}
          {contract.status !== "active" && !contract.employer_signed_at && (
            <button onClick={signEmployer} disabled={pending}
              className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-semibold inline-flex items-center gap-1">
              <FileSignature className="w-4 h-4" /> {t("Công ty ký")}
            </button>
          )}
          {contract.status !== "active" && !contract.employee_signed_at && (
            <button onClick={signEmployee} disabled={pending}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold inline-flex items-center gap-1">
              <FileSignature className="w-4 h-4" /> {t("NV ký")}
            </button>
          )}
          {contract.status === "active" && (
            <button onClick={() => setShowTerminate(!showTerminate)}
              className="px-4 py-2 bg-red-100 text-red-700 border border-red-200 rounded text-sm font-semibold inline-flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> {t("Chấm dứt")}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} text-sm`}>
          {msg.text}
        </div>
      )}

      {showTerminate && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 items-center">
          <input value={termReason} onChange={e => setTermReason(e.target.value)}
            placeholder={t("Lý do chấm dứt HĐ (bắt buộc)")}
            className="flex-1 p-2 border border-red-300 rounded text-sm" />
          <button onClick={onTerminate} disabled={pending}
            className="px-3 py-2 bg-red-600 text-white rounded text-sm">{t("Xác nhận")}</button>
          <button onClick={() => setShowTerminate(false)} className="px-3 py-2 border rounded text-sm">{t("Huỷ")}</button>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-6 space-y-4">
        <div className="flex justify-between items-start flex-wrap">
          <div>
            <div className="text-xs text-gray-500 uppercase">{t("Số HĐ")}</div>
            <div className="tabular-nums font-bold text-lg">{contract.contract_number}</div>
          </div>
          <StatusBadge status={contract.status} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500 uppercase">{t("Bên A — Người sử dụng lao động")}</div>
            <div className="font-semibold mt-1">{t("Công ty Cổ phần ACME")}</div>
            <div className="text-gray-600 text-xs">{truSoTheoNgay(contract.effective_date)}</div>
            <div className="text-gray-600 text-xs">{t("Đại diện: Nguyễn Văn An — Tổng giám đốc")}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">{t("Bên B — Người lao động")}</div>
            <div className="font-semibold mt-1">{contract.user?.full_name}</div>
            <div className="text-gray-600 text-xs">{t("CCCD:")} {contract.user?.cccd || "—"}</div>
            <div className="text-gray-600 text-xs">{t("SĐT:")} {contract.user?.phone || "—"}</div>
            <div className="text-gray-600 text-xs">{t("Email:")} {contract.user?.email}</div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Cell label={t("Loại HĐ")} value={t(TYPE_LABEL[contract.contract_type]) ? t(TYPE_LABEL[contract.contract_type]) : contract.contract_type} />
          <Cell label={t("Hiệu lực")} value={contract.effective_date} />
          <Cell label={t("Đến")} value={contract.end_date || t("Vô thời hạn")} />
          <Cell label={t("Hết thử việc")} value={contract.probation_end_date || "—"} />
          <Cell label={t("Chức vụ")} value={contract.position} />
          <Cell label={t("Phòng ban")} value={contract.department?.name || "—"} />
          <Cell label={t("Lương cơ bản")} value={fmtVND(contract.base_salary) + (contract.salary_pct < 100 ? ` (${contract.salary_pct}%)` : "")} />
          <Cell label={t("Lương BH")} value={fmtVND(contract.insurance_salary)} />
          <Cell label={t("Phụ cấp")} value={fmtVND(contract.allowance)} />
          <Cell label={t("Thưởng max")} value={fmtVND(contract.bonus_max)} />
        </div>

        {contract.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
            <b>{t("Ghi chú:")}</b> {contract.notes}
          </div>
        )}

        <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-gray-500 uppercase">{t("Bên A (công ty) ký")}</div>
            {contract.employer_signed_at ? (
              <div className="mt-1 text-emerald-700 font-semibold inline-flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> {t("Đã ký")}
                <div className="text-gray-500 font-normal ml-1">
                  · {new Date(contract.employer_signed_at).toLocaleString("vi-VN")}
                </div>
                {contract.employer_signer && <div className="text-gray-600 mt-0.5">{t("Bởi:")} {contract.employer_signer.full_name}</div>}
              </div>
            ) : (
              <div className="mt-1 text-yellow-700 inline-flex items-center gap-1"><Clock className="w-4 h-4" /> {t("Chưa ký")}</div>
            )}
          </div>
          <div>
            <div className="text-gray-500 uppercase">{t("Bên B (NV) ký")}</div>
            {contract.employee_signed_at ? (
              <div className="mt-1 text-emerald-700 font-semibold inline-flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> {t("Đã ký")}
                <div className="text-gray-500 font-normal ml-1">
                  · {new Date(contract.employee_signed_at).toLocaleString("vi-VN")}
                </div>
              </div>
            ) : (
              <div className="mt-1 text-yellow-700 inline-flex items-center gap-1"><Clock className="w-4 h-4" /> {t("Chưa ký")}</div>
            )}
          </div>
        </div>

        {contract.status === "terminated" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
            <b className="text-red-700">{t("Đã chấm dứt ngày")} {contract.terminated_at}</b>
            <div className="text-red-600 mt-0.5">{contract.termination_reason}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLang();
  const cfg: Record<string, { label: string; color: string }> = {
    draft: { label: t("Nháp"), color: "bg-gray-100 text-gray-700" },
    pending_signatures: { label: t("⏳ Chờ ký"), color: "bg-yellow-100 text-yellow-700" },
    signed_by_employee: { label: t("NV đã ký"), color: "bg-blue-100 text-blue-700" },
    signed_by_employer: { label: t("Công ty đã ký"), color: "bg-blue-100 text-blue-700" },
    active: { label: t("✓ Có hiệu lực"), color: "bg-emerald-100 text-emerald-700" },
    expired: { label: t("Hết hạn"), color: "bg-gray-100 text-gray-500" },
    terminated: { label: t("Đã chấm dứt"), color: "bg-red-100 text-red-700" },
  };
  const c = cfg[status] || cfg.draft;
  return <span className={`px-3 py-1 rounded font-semibold ${c.color}`}>{t(c.label)}</span>;
}

function Cell({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
